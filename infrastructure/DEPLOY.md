# Deployment Runbook — Equitas Elite

End-to-end deployment from a clean AWS account to a live HTTPS site at
`https://equitaselite.com`. Execute in order. Allow ~2 hours for the first run
(RDS multi-AZ provisioning takes ~20 min on its own).

> **TL;DR for everyday use:** §1–§9 are first-time bootstrap. After that, every
> code change deploys via `git push origin master` — the `Deploy` GitHub Actions
> workflow takes over. See §6.

---

## 0. Prerequisites

| Tool          | Version  | Install                                            |
|---------------|----------|----------------------------------------------------|
| AWS CLI v2    | latest   | `brew install awscli`                              |
| Terraform     | ≥ 1.5    | `brew tap hashicorp/tap && brew install hashicorp/tap/terraform` |
| Docker        | latest   | `brew install --cask docker` (then launch Docker.app once to start the daemon) |
| psql client   | ≥ 14     | `brew install libpq && brew link --force libpq`    |
| jq            | latest   | `brew install jq`                                  |

Configure AWS credentials with admin access in the target account:
```sh
aws configure --profile equitaselite-prod
export AWS_PROFILE=equitaselite-prod
aws sts get-caller-identity   # sanity check
```

Set `AWS_REGION=us-east-1` if it isn't already in your profile.

---

## 1. Bootstrap Terraform remote state

Terraform's S3 backend can't manage its own state bucket. Create it once by hand.

```sh
# KMS key for state encryption
aws kms create-key \
  --description "Terraform state encryption" \
  --query 'KeyMetadata.KeyId' --output text

# Save the KeyId, then:
aws kms create-alias \
  --alias-name alias/terraform-state \
  --target-key-id <KeyId from above>

# State bucket (versioning + KMS + block public access)
aws s3api create-bucket \
  --bucket equitaselite-terraform-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket equitaselite-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket equitaselite-terraform-state \
  --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":{
      "SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/terraform-state"
    }}]}'

aws s3api put-public-access-block \
  --bucket equitaselite-terraform-state \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Lock table for concurrent applies
aws dynamodb create-table \
  --table-name equitaselite-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

---

## 2. Terraform apply

Create a `prod.tfvars` to capture per-environment values you don't want in git:

```sh
cd infrastructure/
cat > prod.tfvars <<EOF
environment  = "prod"
admin_emails = "you@example.com"
EOF
echo "prod.tfvars" >> .gitignore   # if not already excluded

terraform init
terraform plan  -var-file=prod.tfvars -out=tfplan
terraform apply tfplan
```

Expect the apply to take **20–25 minutes** (RDS multi-AZ provisioning dominates).
If it errors halfway through, just rerun `terraform apply`.

Capture outputs you'll need:
```sh
terraform output -json > outputs.json
terraform output alb_dns_name
terraform output acm_validation_records
terraform output ecr_repository_url
terraform output cognito_user_pool_id
terraform output rds_endpoint
```

---

## 3. DNS — ACM certificate validation

ACM created the certificate in pending state; it stays pending until you add the
validation CNAME records.

```sh
terraform output acm_validation_records
```

In your DNS provider (GoDaddy or wherever `equitaselite.com` is registered),
add each `name` → `value` CNAME from that output. Strip the trailing dot from
both values.

Wait 5–30 minutes, then verify:
```sh
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw acm_certificate_arn) \
  --query 'Certificate.Status'
# Should print "ISSUED"
```

Until this is ISSUED, the ALB listener can't be created — but Terraform already
ran `aws_acm_certificate_validation` which blocks the apply on this. If you see
the apply stuck on validation, the DNS records are missing or propagating.

---

## 4. DNS — apex domain → ALB

> ⚠️ **GoDaddy can't CNAME the apex domain `equitaselite.com`**. Two paths:
>
> **A. Move DNS to Route 53 (recommended for production).** Create a hosted zone,
>    change the nameservers at GoDaddy, then add an ALIAS A record to the ALB.
>    *Not yet in Terraform — add `aws_route53_zone` + `aws_route53_record` if you
>    take this path.*
>
> **B. Use `www.equitaselite.com` + GoDaddy forwarding.** Add CNAME
>    `www.equitaselite.com` → ALB DNS. Set GoDaddy "Domain forwarding" to redirect
>    apex → `https://www.equitaselite.com`. Cheap but slow first hit.

Either way, get the ALB DNS name:
```sh
terraform output alb_dns_name
# e.g. equitaselite-prod-1234567890.us-east-1.elb.amazonaws.com
```

---

## 5. First deploy (bootstrap only)

Terraform created the ECR repo and ECS service but the service can't pull
`:latest` because no image exists there yet. **This is the only deploy you'll
ever do by hand** — everything after this happens via GitHub Actions on push.

```sh
cd ../nextjs/

ECR_URL=$(cd ../infrastructure && terraform output -raw ecr_repository_url)

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "$ECR_URL"

docker build --platform linux/amd64 -t equitaselite:bootstrap .
docker tag  equitaselite:bootstrap "$ECR_URL:bootstrap"
docker push "$ECR_URL:bootstrap"

# Point the existing task definition at this image and roll the service
aws ecs describe-task-definition --task-definition equitaselite-prod \
  --query 'taskDefinition' \
| jq --arg img "$ECR_URL:bootstrap" '
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
        .compatibilities, .registeredAt, .registeredBy)
    | .containerDefinitions[0].image = $img
  ' \
| aws ecs register-task-definition --cli-input-json file:///dev/stdin --query 'taskDefinition.taskDefinitionArn' --output text \
| xargs -I {} aws ecs update-service \
    --cluster equitaselite-prod --service equitaselite-prod \
    --task-definition {}

aws ecs wait services-stable --cluster equitaselite-prod --services equitaselite-prod
```

If a task fails to start, tail CloudWatch:
```sh
aws logs tail /ecs/equitaselite-prod --follow --since 5m
```

Common first-deploy failures: image pull denied (ECR auth expired), missing
env var (check `aws_ecs_task_definition.app` environment list in `ecs.tf`),
DB connection timeout (security group rules).

---

## 6. Subsequent deploys — automatic

**`git push origin master` is the deploy.** The `Deploy` GitHub Actions
workflow (`.github/workflows/deploy.yml`) does the rest:

1. Assumes the `equitaselite-github-deploy-prod` IAM role via OIDC (no
   long-lived keys anywhere)
2. Builds the Docker image on a native amd64 runner, tagged `${git-sha}`
3. Pushes to ECR
4. Reads the current task definition, swaps the image, registers a new
   revision (env vars and other config flow through from whatever Terraform
   has registered)
5. Updates the ECS service to point at the new revision
6. Waits for `services-stable`
7. Curls `/api/health` to verify

Watch a deploy with `gh run watch` or in the **Actions** tab on GitHub. A
typical green deploy is ~4–5 minutes end-to-end.

### When you need to change task-definition config (env vars, CPU, memory)

The lifecycle rule on `aws_ecs_task_definition.app` ignores
`container_definitions` so the CI-managed image doesn't fight you. Flow:

1. Edit `ecs.tf` (or `prod.tfvars`)
2. `terraform apply -var-file=prod.tfvars` — registers a *new* task-def
   revision with your config change, but doesn't roll the service yet
3. Push any code change (or `gh workflow run deploy.yml`) — the deploy reads
   the latest revision (your new config) before swapping in the new image, so
   both land together

### Force a deploy without a code change

```sh
gh workflow run deploy.yml
```

---

## 7. Apply database migrations

RDS is in private subnets and not publicly accessible. Easiest path for the
first deploy: a temporary EC2 bastion + SSM port forwarding.

```sh
# 1. Find a public subnet ID
PUBLIC_SUBNET=$(aws ec2 describe-subnets \
  --filters "Name=tag:Name,Values=equitaselite-public-*" \
  --query 'Subnets[0].SubnetId' --output text)

# 2. Create a minimal SG that allows outbound to RDS
RDS_SG=$(cd ../infrastructure && terraform output -json | jq -r '.vpc_id.value' | xargs -I {} \
  aws ec2 describe-security-groups --filters "Name=vpc-id,Values={}" \
  "Name=group-name,Values=*-rds-*" --query 'SecurityGroups[0].GroupId' --output text)

# 3. Launch t3.micro Amazon Linux 2023 with SSM agent
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --instance-type t3.micro \
  --subnet-id "$PUBLIC_SUBNET" \
  --iam-instance-profile Name=AmazonSSMRoleForInstancesQuickSetup \
  --associate-public-ip-address \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

# Allow the bastion to reach RDS
INSTANCE_SG=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG" --protocol tcp --port 5432 --source-group "$INSTANCE_SG"

# 4. Start an SSM port-forward session in another terminal
RDS_HOST=$(cd ../infrastructure && terraform output -raw rds_endpoint)
aws ssm start-session --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$RDS_HOST,portNumber=5432,localPortNumber=5432"
# Leave this running in another terminal.

# 5. Get DB password from Secrets Manager
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id equitaselite/prod/db-password \
  --query SecretString --output text)

# 6. Apply migrations via the tunnel
PGPASSWORD="$DB_PASS" psql -h localhost -p 5432 \
  -U equitaselite_admin -d equitaselite \
  -f db/migrations/001_create_profiles.sql

PGPASSWORD="$DB_PASS" psql -h localhost -p 5432 \
  -U equitaselite_admin -d equitaselite \
  -f db/migrations/002_create_introductions.sql

# 7. Verify
PGPASSWORD="$DB_PASS" psql -h localhost -p 5432 \
  -U equitaselite_admin -d equitaselite \
  -c "\dt"

# 8. Tear down the bastion
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID"
```

---

## 8. Create the first admin user

The `/admin` page is gated on `ADMIN_EMAILS`, which you set via `admin_emails`
in `prod.tfvars` (step 2). The ECS task definition pulls it through automatically.

Invite yourself:

```sh
POOL_ID=$(cd infrastructure && terraform output -raw cognito_user_pool_id)

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "you@example.com" \
  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

Cognito emails a temp password. Sign in at `https://equitaselite.com`, complete
the new-password + MFA-setup flow, then complete onboarding. The Admin link
will appear in the dashboard header.

---

## 9. Verify the deployment

```sh
# Health endpoint
curl -fsSL https://equitaselite.com/api/health

# Pricing page is public
curl -fsSL -o /dev/null -w "%{http_code}\n" https://equitaselite.com/pricing
# Should be 200

# Dashboard requires auth
curl -fsSL -o /dev/null -w "%{http_code}\n" https://equitaselite.com/dashboard
# Should be 302 (redirect to /)
```

Watch logs while you click through:
```sh
aws logs tail /ecs/equitaselite-prod --follow --since 5m
```

---

## 10. What's done and what's still open

### Done
- ✅ **GitHub OIDC + deploy role** — `github-oidc.tf`. Scoped to this repo;
  permissions are minimum-viable (ECR push, ECS describe/register/update,
  IAM PassRole on the two task roles with `iam:PassedToService` condition).
- ✅ **ECR git-SHA tags** — workflow pushes `:${github.sha}` only. ECR stays
  `IMMUTABLE`; no tag collisions because every commit is unique.
- ✅ **Route 53 hosted zone** — `route53.tf`. ALIAS A records for apex and
  `www`. ACM validation CNAME is mirrored into the zone so the cert auto-renews
  even after nameservers move off GoDaddy.

### Still open

1. **Migration runner.** Schema migrations still go through one of:
   - The bastion + SSM port-forward dance documented in §7 (for the initial
     `001_create_profiles.sql` and `002_create_introductions.sql`)
   - Admin endpoints like `POST /api/admin/init-notifications` (which embed
     the migration SQL and run it with admin auth)

   The proper fix is a `migrate` ECS task definition + a workflow step that
   `aws ecs run-task`'s it before updating the app service. Not yet built.

2. **Custom Cognito invitation email.** Cognito currently sends invites from
   `no-reply@verificationemail.com` because the SES domain identity for
   `equitaselite.com` was never verified (and the `noreply@` mailbox doesn't
   exist to receive the verification link). To switch back to branded sending:
   add an `aws_ses_domain_identity` + DKIM CNAME records in Route 53 (now that
   we control DNS via Route 53), wait for `VerificationStatus = Success`, then
   change `cognito.tf`'s `email_configuration` back to `DEVELOPER` mode with
   `source_arn` pointing at the domain identity.

3. **`tfplan` artifact / `prod.tfvars`.** Both stay local — they hold real
   account-specific config and should never be committed. Confirm they're in
   `infrastructure/.gitignore` or repo-root `.gitignore` before contributors
   are added.

4. **Bump GitHub Actions to Node 24.** Both `ci.yml` and `deploy.yml` use
   `actions/checkout@v4` and friends, which run on Node 20. Deprecation
   deadline is 2026-09-16; bump to v5 (or set
   `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`) before then.

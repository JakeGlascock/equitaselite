# Deployment Runbook — Equitas Elite

End-to-end manual deployment from a clean AWS account to a live HTTPS site.
Execute in order. Allow ~2 hours for the first run (RDS multi-AZ takes ~20 min on its own).

When you're done, the app is live at `https://equitaselite.com`.
We'll automate this with GitHub Actions after the first manual deploy succeeds.

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

## 5. Build & push the Docker image

```sh
cd ../nextjs/   # repo root /nextjs

ECR_URL=$(cd ../infrastructure && terraform output -raw ecr_repository_url)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "$ECR_URL"

docker build -t equitaselite:latest .
docker tag  equitaselite:latest "$ECR_URL:latest"
docker push "$ECR_URL:latest"
```

> ⚠️ ECR has `image_tag_mutability = "IMMUTABLE"`. The first `:latest` push works.
> Subsequent pushes to `:latest` will fail. When we automate, we'll switch to
> git-SHA tags and update the task definition each deploy. For this first manual
> deploy, `:latest` is fine.

---

## 6. Roll the ECS service

Terraform created the service but it tried to pull `:latest` before any image
existed. Force a new deployment now that the image is in ECR:

```sh
CLUSTER=$(cd ../infrastructure && terraform output -raw ecs_cluster_name)
SERVICE=$(cd ../infrastructure && terraform output -raw ecs_service_name)

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment

# Watch it stabilize (~3-5 min)
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"
```

If a task fails to start, check CloudWatch logs:
```sh
aws logs tail /ecs/equitaselite-prod --follow
```

Common causes: image pull denied (ECR auth), task can't reach Secrets Manager
(check VPC endpoints), health check failing (`/api/health` should 200).

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

## 10. Known gaps to address when automating

These don't block the first manual deploy but need fixing before CI/CD:

1. **ECR tag mutability.** `image_tag_mutability = "IMMUTABLE"` blocks reusing
   `:latest`. Switch the deploy workflow to push `:${git-sha}` and update the
   task definition image each time.

2. **Migration runner.** Replace the bastion approach with a one-off ECS task:
   add a `migrate` task definition that runs `node scripts/migrate.js` (script
   to be written), call `aws ecs run-task` from the deploy workflow before
   updating the app service.

3. **GitHub OIDC.** Add `aws_iam_openid_connect_provider` + a deploy IAM role
   in Terraform so GitHub Actions can assume it without long-lived keys.
   Required permissions: ECR push, ECS update, IAM PassRole, ECS run-task.

4. **Route 53 hosted zone.** If you went with the GoDaddy forwarding workaround
   in §4, swap to Route 53 properly. Add `aws_route53_zone` + ALIAS A record to
   Terraform.

5. **Custom Cognito invitation email.** The default Cognito email is generic.
   Set `email_message` and `email_subject` on `aws_cognito_user_pool.admin_create_user_config`
   to match the brand.

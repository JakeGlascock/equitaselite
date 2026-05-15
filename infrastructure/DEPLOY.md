# Deployment Runbook — Equitas Elite

End-to-end deployment from a clean AWS account to a live HTTPS site at
`https://equitaselite.com`. Execute in order. Allow ~2 hours for the first run
(RDS multi-AZ provisioning takes ~20 min on its own).

> **TL;DR for everyday use:** §1–§6 are first-time bootstrap. After that, every
> code change ships via `git push origin master` — the `Deploy` GitHub Actions
> workflow takes over and the migration runner applies any new
> `nextjs/db/migrations/*.sql` automatically. See §6 and §7.

---

## 0. Prerequisites

| Tool          | Version  | Install                                            |
|---------------|----------|----------------------------------------------------|
| AWS CLI v2    | latest   | `brew install awscli`                              |
| Terraform     | ≥ 1.5    | `brew tap hashicorp/tap && brew install hashicorp/tap/terraform` |
| Docker        | latest   | `brew install --cask docker` (launch Docker.app once to start the daemon) |
| psql client   | ≥ 14     | `brew install libpq && brew link --force libpq` (only needed for direct DB access in §10) |
| jq            | latest   | `brew install jq`                                  |
| gh CLI        | latest   | `brew install gh` (for `gh run` watch / dispatch)  |

Configure AWS credentials with admin access in the target account:

```sh
aws configure sso --profile equitaselite-prod
export AWS_PROFILE=equitaselite-prod
aws sts get-caller-identity   # sanity check
```

Set `AWS_REGION=us-east-1`.

---

## 1. Bootstrap Terraform remote state

Terraform's S3 backend can't manage its own state bucket. Create it once by hand.

```sh
# KMS key for state encryption
aws kms create-key \
  --description "Terraform state encryption" \
  --query 'KeyMetadata.KeyId' --output text

aws kms create-alias \
  --alias-name alias/terraform-state \
  --target-key-id <KeyId from above>

# State bucket — versioning + KMS + block public access
aws s3api create-bucket \
  --bucket equitaselite-terraform-state --region us-east-1

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

Create a `prod.tfvars` to hold per-environment values you don't want in git:

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
terraform output route53_nameservers
```

---

## 3. DNS — ACM certificate validation

ACM created the certificate in pending state; it stays pending until the
validation CNAMEs exist. Terraform mirrors them into the Route 53 zone
automatically, so just point `equitaselite.com` at the AWS nameservers:

```sh
terraform output route53_nameservers
```

At your registrar (GoDaddy, etc.), set the four AWS nameservers and wait
5–30 minutes. Verify with:

```sh
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw acm_certificate_arn) \
  --query 'Certificate.Status'
# Should print "ISSUED"
```

---

## 4. Branded sender — SES domain identity

The SES domain identity for `equitaselite.com` is created via Terraform with
DKIM + SPF + DMARC records mirrored into Route 53. After §3 lands, SES
verification completes within 5–15 minutes. Verify:

```sh
aws sesv2 get-email-identity --email-identity equitaselite.com \
  --query 'VerifiedForSendingStatus'
# Should print "true"
```

Outbound mail from `system@equitaselite.com` (Cognito invites, intro
notifications, smoke alerts) starts working as soon as that flips. The
inbound alias `access@equitaselite.com` lives in Google Workspace (separate
MX records — see `infrastructure/google-workspace.tf`).

---

## 5. First image push

Terraform created the ECR repo and ECS service but the service can't start
because no image exists in ECR yet. **This is the only deploy you'll ever do
by hand** — everything after this happens via GitHub Actions on push.

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

After this, `git push origin master` is the deploy.

---

## 6. Subsequent deploys — automatic

`git push origin master` triggers `.github/workflows/deploy.yml`, which:

1. Assumes the `equitaselite-github-deploy-prod` IAM role via OIDC (no
   long-lived keys anywhere).
2. Builds the Docker image on a native amd64 runner, tagged `${git-sha}`.
   The push step is idempotent on ECR's `IMMUTABLE` tag policy — if a prior
   run already pushed this SHA, it reuses the image.
3. Pushes to ECR.
4. Registers a new task-definition revision pointing at the new image.
5. **Runs the migration runner as a one-off Fargate task** with a
   `node scripts/migrate.mjs` command override (see §7 below). Deploy
   aborts if the task exits non-zero.
6. Updates the ECS service to point at the new revision.
7. Waits for `services-stable`.
8. Curls `/api/health` to verify.

Watch a deploy with `gh run watch` or in the **Actions** tab. A typical
green deploy is ~4–5 minutes end-to-end.

### Changing task-definition config (env vars, CPU, memory)

The lifecycle rule on `aws_ecs_task_definition.app` ignores
`container_definitions` so the CI-managed image doesn't fight you.

1. Edit `ecs.tf` (or `prod.tfvars`)
2. `terraform apply -var-file=prod.tfvars` — registers a new task-def
   revision with your config change, but doesn't roll the service yet
3. Push any code change (or `gh workflow run deploy.yml`) — the deploy
   reads the latest revision (your new config) before swapping in the
   new image, so both land together

### Force a deploy without a code change

```sh
gh workflow run deploy.yml
```

---

## 7. Database migrations

**They're automatic.** Every push runs `nextjs/scripts/migrate.mjs` as an
ECS one-off Fargate task inside the same private subnets + security group
as the main service, before the service rolls. The script:

1. Creates `schema_migrations(version, checksum, applied_at)` if missing.
2. Reads `nextjs/db/migrations/*.sql` in lexical order.
3. For each file already in `schema_migrations`, re-hashes the content and
   aborts on a checksum mismatch (catches edits to applied migrations).
4. For each unapplied file, runs the SQL + records the version + checksum
   in a single transaction.

To add a schema change: create `nextjs/db/migrations/00N_xxx.sql` with
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / etc. Push.
Done.

The migration runner needs `ecs:RunTask` + log permissions on the deploy
role — see `infrastructure/github-oidc.tf:github_deploy_ecs_run_task`.

---

## 8. Create the first admin user

The `/admin` page is gated on `ADMIN_EMAILS` (set via `admin_emails` in
`prod.tfvars`, step 2) **and** on the per-user `is_admin` column. Invite
yourself:

```sh
POOL_ID=$(cd infrastructure && terraform output -raw cognito_user_pool_id)

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "you@example.com" \
  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

Cognito emails a temp password from `system@equitaselite.com`. Sign in at
`https://equitaselite.com/signin`, complete the new-password + MFA-setup
flow (one TOTP entry — the deploy logic skips the duplicate prompt), then
complete onboarding. The Admin link appears in the header because your
email is in `ADMIN_EMAILS`.

Subsequent admins can be flipped from `/admin` itself via the Admin toggle
on each member row.

---

## 9. Smoke tests + alerts

`.github/workflows/smoke.yml` runs:

- After every successful Deploy (`workflow_run` trigger)
- Hourly (`cron: '0 * * * *'`)
- On manual dispatch with an optional `url` input

Checks: `/api/health` JSON, `/`, `/signin`, `/pricing`,
`/request-access` body markers, and `/dashboard` redirect to `/signin`.

Failure sends an email via SES to `alert@equitaselite.com` (the Workspace
mailbox you created during §4) with the last 30 lines of script output
and a workflow-run link. Successful runs are silent.

Test the alert path with `gh workflow run smoke.yml -f url=https://nonexistent.equitaselite.com`.

---

## 10. Direct DB access (rare)

The migration runner covers schema changes. For ad-hoc reads / writes
(debugging a stuck record, manual data fix, etc.) you still need a path
into the private subnet. Spin up a temporary SSM bastion:

```sh
# 1. Find a public subnet ID
PUBLIC_SUBNET=$(aws ec2 describe-subnets \
  --filters "Name=tag:Name,Values=equitaselite-public-*" \
  --query 'Subnets[0].SubnetId' --output text)

# 2. Find the RDS SG
RDS_SG=$(cd ../infrastructure && terraform output -json | jq -r '.vpc_id.value' | xargs -I {} \
  aws ec2 describe-security-groups --filters "Name=vpc-id,Values={}" \
  "Name=group-name,Values=*-rds-*" --query 'SecurityGroups[0].GroupId' --output text)

# 3. Launch t3.micro with SSM agent
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --instance-type t3.micro \
  --subnet-id "$PUBLIC_SUBNET" \
  --iam-instance-profile Name=AmazonSSMRoleForInstancesQuickSetup \
  --associate-public-ip-address \
  --query 'Instances[0].InstanceId' --output text)
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

INSTANCE_SG=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG" --protocol tcp --port 5432 --source-group "$INSTANCE_SG"

# 4. Start an SSM port-forward (leave running in another terminal)
RDS_HOST=$(cd ../infrastructure && terraform output -raw rds_endpoint)
aws ssm start-session --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$RDS_HOST,portNumber=5432,localPortNumber=5432"

# 5. Get the password and connect
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id equitaselite/prod/db-password \
  --query SecretString --output text)
PGPASSWORD="$DB_PASS" psql -h localhost -p 5432 \
  -U equitaselite_admin -d equitaselite

# 6. Tear down when done
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID"
```

Recovery procedures (PITR, snapshot restore, ECS rollback) live in
[`../nextjs/db/RESTORE.md`](../nextjs/db/RESTORE.md).

---

## 11. What's done and what's still open

### Done
- ✅ **GitHub OIDC + deploy role** — `github-oidc.tf`. Scoped to this repo;
  permissions are minimum-viable (ECR push, ECS describe/register/update/run-task,
  IAM PassRole on the two task roles with `iam:PassedToService` condition,
  CloudWatch GetLogEvents for the migration log stream, SES SendEmail on the
  domain identity for smoke alerts).
- ✅ **ECR git-SHA tags** — workflow pushes `:${github.sha}` only. ECR stays
  `IMMUTABLE`; idempotent push tolerates retries of failed deploys.
- ✅ **Route 53 hosted zone** — `route53.tf`. ALIAS A records for apex and
  `www`. ACM validation CNAME mirrored into the zone so the cert auto-renews.
- ✅ **Automated migration runner** — see §7. Replaced the bastion-and-init-button
  dance.
- ✅ **Branded SES sender** — `system@equitaselite.com` with DKIM + SPF + DMARC
  `p=quarantine; pct=25`. Cognito invites and intro notifications both use it.
- ✅ **Smoke tests + alerts** — see §9.
- ✅ **GitHub Actions on Node 24** — `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`
  at each workflow's `env`, ahead of the June 2026 Node 20 deprecation.

### Still open

1. **DMARC ratchet from `pct=25` → `pct=100` → `p=reject`.** Apply after a
   few weeks of clean DMARC aggregate reports at `dmarc-reports@equitaselite.com`.
2. **Storage autoscaling on RDS.** Add `max_allocated_storage = 500` to
   `aws_db_instance.main` in `rds.tf` so the DB doesn't run out of space.
3. **Cross-region backup copies.** Snapshots currently live only in
   us-east-1. Add `replicate_source_db` or an EventBridge + Lambda
   snapshot-copy schedule to a DR region.
4. **Dedicated migration role.** The runner currently authenticates as
   the DB superuser (`equitaselite_admin`). Create a `migrate_role` with
   `CREATE`, `ALTER`, `ADD COLUMN`, etc., but not `DROP TABLE` / `TRUNCATE`.
5. **`tfplan` artifact / `prod.tfvars`.** Both stay local — they hold real
   account-specific config and should never be committed. Confirm they're
   in `infrastructure/.gitignore` before contributors are added.
6. **rds.force_ssl parameter-group drift.** `terraform plan` shows
   `apply_method` differs between code and state. Investigate before the
   next blanket `terraform apply` (target-apply specific resources for
   now — see the IAM policy apply during the migration-runner build for
   the pattern).

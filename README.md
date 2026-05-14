# Equitas Elite

> Private, invitation-only platform that matches Angel Investors with Family
> Offices on mandate alignment.

Live at **[equitaselite.com](https://equitaselite.com)** (production, AWS
us-east-1). Access is gated — visitors land on `/request-access` and
submissions are triaged from `/admin`.

---

## What it does

- **4-step onboarding** captures role, sectors, stages, check size,
  geography, risk tolerance, and role-specific preferences (return / horizon
  for angels; mandate / structure for family offices).
- **Match scoring** ranks counterparties on four weighted dimensions
  (`src/lib/scoring.ts`). Strong-fit / Good-fit / Possible-fit / Low-fit
  bands surface on the dashboard.
- **Introduction requests** with an inline note; recipient gets an in-app
  notification + SES email (gated on the recipient's email preference).
  Accepting an intro reveals both parties' contact email.
- **Three membership tiers** (Access / Select / Sovereign) with real
  server-side enforcement: match cap, intro cap, priority placement in
  others' match lists.
- **Concierge role** lets EE staff create and "Operate as" managed accounts
  on behalf of clients who prefer a white-glove flow.

## How it's built

| Layer | Tech |
|---|---|
| App | Next.js 15 (App Router, RSC), React 19, TypeScript, Tailwind CSS |
| Database | PostgreSQL 17 on RDS, accessed via `pg` |
| Auth | AWS Cognito (USER_PASSWORD_AUTH + TOTP MFA), JWTs verified with `jose` in middleware |
| Email | AWS SES (DKIM + SPF + DMARC `p=quarantine; pct=25`) sending from `noreply@equitaselite.com` |
| Storage | S3 (KMS-encrypted) for the document vault |
| Runtime | ECS Fargate behind an Application Load Balancer (ACM TLS 1.3) |
| Edge | AWS WAF on the ALB; rate-limited per IP |
| DNS | Route 53 zone for `equitaselite.com`, ALIAS to ALB |
| Secrets | AWS Secrets Manager (KMS-encrypted) for DB password + JWT secret |
| Observability | CloudWatch logs + Performance Insights + CloudTrail + an hourly synthetic smoke job |

Infrastructure-as-code lives in [`infrastructure/`](infrastructure/) (Terraform).
The Next.js app lives in [`nextjs/`](nextjs/).

## Deploy

Every push to `master` triggers `.github/workflows/deploy.yml`:

1. Build the container, push to ECR (SHA tag, immutable).
2. Register a new task definition revision pointing at the new image.
3. **Run DB migrations as a one-off Fargate task** using the new image
   — `nextjs/scripts/migrate.mjs` applies any new `db/migrations/*.sql`
   inside transactions and tracks them in a `schema_migrations` table with
   per-file checksums. Deploy aborts if a migration fails.
4. Update the ECS service to the new task def, wait for stable.
5. Hit `/api/health` to verify the rollout took.

Schema changes are just: drop a `db/migrations/00N_xxx.sql` file, push.
No manual admin clicks.

Authentication to AWS uses GitHub OIDC — no long-lived access keys.

## Smoke tests

`.github/workflows/smoke.yml` hits `/api/health`, `/`, `/signin`, `/pricing`,
`/request-access`, and an auth-gated `/dashboard` (must redirect)
**after every successful deploy** *and* **hourly on a schedule**.

Failures email `alert@equitaselite.com` via SES with the CloudWatch log
extract and a link to the workflow run.

## Data safety

- **Multi-AZ RDS** with **35-day point-in-time recovery** — every change
  in the last 35 days is restorable to the second.
- **KMS encryption** at rest (RDS, S3, Secrets Manager, CloudWatch).
- **`rds.force_ssl=1`** + app connects over TLS.
- **Deletion protection** ON; final snapshot taken on destroy.
- **Migration runner** verifies file checksums — editing an applied
  migration aborts the next deploy instead of silently drifting schemas.

Full recovery playbook in [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md).

## Repo layout

```
nextjs/                Next.js app (the only thing that runs in prod)
  src/app/(app)/       Authenticated routes (dashboard, profile, admin, …)
  src/app/api/         Route handlers
  src/lib/             Shared library (db, auth, matching, membership, …)
  src/components/      Reusable client components
  db/migrations/       SQL migrations applied automatically on each deploy
  db/RESTORE.md        Recovery playbook
  scripts/             Operational scripts (migrate, smoke)
infrastructure/        Terraform (VPC, ECS, RDS, Cognito, WAF, Route53, SES, …)
  DEPLOY.md            First-deploy runbook
.github/workflows/     CI, Deploy, Smoke
```

Top-level `*.html` files are historical prototype artifacts from before the
Next.js port. They're not served in production and are kept for reference.

## Operating docs

| Doc | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design, data flow, module structure |
| [`PROTOCOL.md`](PROTOCOL.md) | Day-to-day procedures — deploys, schema changes, incident response |
| [`PLANNING.md`](PLANNING.md) | Roadmap and pricing-tier build plan |
| [`SKILL.md`](SKILL.md) | Reusable recipes (add a page, add a migration, add an admin action) |
| [`AGENTS.md`](AGENTS.md) | Working in this codebase as an AI agent |
| [`DESIGN.md`](DESIGN.md) | Brand tokens + design system |
| [`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md) | First-time deploy / disaster-recovery rebuild |
| [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md) | DB recovery playbook |

## Local development

The Next.js app uses standard tooling (`npm install`, `npm run dev`).
Database access requires a Postgres instance reachable from your machine —
prod RDS is private-subnet only, so local dev currently means pointing at a
local Postgres (run `db/migrations/*.sql` against it). A documented
docker-compose for local Postgres is on the backlog.

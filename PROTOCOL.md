# PROTOCOL.md — Equitas Elite

Day-to-day operational protocols. For first-time deploy, see
[`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md). For DB recovery,
see [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md).

---

## Development

### Local setup

```sh
cd nextjs/
npm install
npm run dev          # → http://localhost:3000
```

You'll need a Postgres instance reachable from your machine — prod RDS is
private-subnet only, so local dev means a local Postgres with the
migrations applied:

```sh
createdb equitaselite_dev
for f in db/migrations/*.sql; do psql equitaselite_dev -f "$f"; done

cat > .env.local <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=equitaselite_dev
DB_USER=$(whoami)
DB_PASSWORD=
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
ADMIN_EMAILS=you@example.com
EOF
```

`DB_HOST` not ending in `.amazonaws.com` skips TLS in `lib/db.ts`.
Cognito IDs come from `terraform output`.

### Workflow

1. Make changes.
2. Run `npm run type-check && npm run lint && npm test` locally.
3. Commit on `master` (no PR-required protection right now — single-author
   project; introduce branch protection when the team grows).
4. `git push origin master` — Deploy + smoke run automatically.

### Tests

- `npm test` — vitest unit suite (scoring, matching, membership,
  acting-as, auth-session route)
- `npm run test:coverage` — fails CI below the thresholds in
  `vitest.config.ts` (80% line/statement/function, 75% branch)
- DB-backed code (`lib/db.ts`, `lib/email.ts`, `lib/admin.ts`,
  `lib/auth.ts`, all DB-backed routes) is excluded from coverage — tested
  only via integration paths (smoke job + the migration runner on each
  deploy).

### Before every commit

- [ ] `npm run type-check` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green
- [ ] No `console.log` left in production code paths (test files are fine)
- [ ] No hardcoded credentials, no `.env*` staged
- [ ] If you touched a schema: dropped a `db/migrations/00N_xxx.sql` file
- [ ] If you touched `infrastructure/`: ran `terraform plan` and reviewed

---

## Git

### Branch model

`master` is production. Every push to it triggers a Deploy.

When a second contributor joins:
1. Turn on branch protection on `master`
2. Require PR approval + a passing CI run
3. Use squash-merge so each merge is one commit on `master`

### Commit messages

Imperative mood, short subject (≤ 70 chars), one blank line, then a body
that explains *why* (not what — the diff shows what). Co-author tags are
appended automatically by the build agent / Claude Code.

Examples that pass review:

```
Migration runner: enable SSL + fix log-stream prefix

Two bugs found running the first migration task in prod:
1. RDS rejected the connection with "no pg_hba.conf entry … no encryption".
2. deploy.yml constructed the wrong CloudWatch log stream name.
```

Don't ship commits whose message is just `Update README` — say *what*
changed and *why*.

---

## Deploy

`git push origin master` *is* the deploy. Watch with:

```sh
gh run watch                       # latest run, all workflows
gh run list --workflow=deploy.yml  # just deploys
```

A green deploy is ~4–5 minutes:
1. Build + push image (ECR, SHA tag, immutable, idempotent on retry).
2. Register a new task-def revision pointing at the new image.
3. Run DB migrations as a one-off Fargate task (`scripts/migrate.mjs`),
   abort the deploy on non-zero exit.
4. Update the ECS service, wait for stable, hit `/api/health`.

### Schema changes

Drop a file in `nextjs/db/migrations/`. Numbering is `0NN_short_name.sql`.
Always use idempotent DDL — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF
NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. For triggers (no `IF NOT
EXISTS` until PG 17.5), prefer `DROP TRIGGER IF EXISTS` followed by
`CREATE TRIGGER`.

Once a migration has been applied, **don't edit it**. The runner records
each file's SHA-256 in `schema_migrations.checksum` and the next deploy
aborts on mismatch. To fix forward, write a new migration.

### Terraform changes

`terraform plan -var-file=prod.tfvars` first. If the plan shows
unexpected drift (resources changing that you didn't touch), use
`terraform apply -target=<resource>` to apply only the resources you
intended. Don't blanket-apply unless the plan is clean.

After `terraform apply`, push a code change (or
`gh workflow run deploy.yml`) so the new task-def revision rolls out.

### Force a deploy

```sh
gh workflow run deploy.yml         # no code change
git commit --allow-empty -m "Re-trigger deploy" && git push   # the chunky way
```

---

## Operations

### Smoke tests

`.github/workflows/smoke.yml`:
- runs after every successful Deploy (`workflow_run`)
- runs hourly on cron
- can be manually dispatched with a custom `url` input

Failures email `alert@equitaselite.com` via SES. Successful runs are
silent — green status in the Actions tab is the only signal.

### Incident: site is down

1. Check the Actions tab for a failed Deploy or Smoke run.
2. Run smoke from your laptop: `node nextjs/scripts/smoke.mjs https://equitaselite.com`
3. ECS service health: `aws ecs describe-services --cluster equitaselite-prod --services equitaselite-prod --query 'services[0].{Running:runningCount,Pending:pendingCount,Desired:desiredCount,Events:events[0:3]}'`
4. Recent container logs: `aws logs tail /ecs/equitaselite-prod --since 15m`
5. RDS state: `aws rds describe-db-instances --db-instance-identifier equitaselite-prod --query 'DBInstances[0].DBInstanceStatus'` (should be `available`)
6. Rollback option: see [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md)
   §2 ("App is broken but the data is fine") for the ECS task-definition
   rollback procedure.

### Incident: migration broke the schema

Stop. Don't push another fix-forward migration until you've decided
between (a) rolling forward with a corrective migration or (b) restoring
to a point in time before the bad migration ran. See
[`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md) §1.

### Admin operations (from `/admin`)

- Invite a user → emails a temp password from Cognito + SES.
- Toggle a user's Admin, Concierge, or Tier from MembersTable.
- Assign a user to a concierge from the "Managed by" dropdown.
- Triage `/admin/access-requests` (status: new → contacted → onboarded /
  declined).
- `Seed demo data` (in the Setup & maintenance details panel) inserts
  17 demo profiles with deterministic random tiers — safe to re-run.

---

## Design

The design system lives in [`DESIGN.md`](DESIGN.md). The Next.js app
uses Tailwind classes that map to the same design tokens; see
`nextjs/tailwind.config.js`.

### Color rules

Never introduce a new hex value. Everything comes from the token set:

| Intent | Class |
|---|---|
| Page background | `bg-ee-bg` |
| Card / surface | `glass-panel` (preset utility) |
| Gold accent (CTAs, current-plan, gold tier) | `text-ee-gold` / `bg-ee-gold` |
| Emerald accent (success, top-score, Sovereign tier) | `text-ee-emerald` |
| Primary text | `text-ee-primary` |
| Muted text | `text-ee-muted` |
| Border | `border-ee-border` |

### Typography

| Use | Class |
|---|---|
| Page / section titles | `font-display` |
| Body | (default) |
| Numbers / monospace / chips | `font-data` |

### Components

- All content cards use `glass-panel`.
- All interactive elements need a 44px touch target (use the `btn-*`
  utilities or matching padding).
- Material Symbols icons via `<span className="material-symbols-outlined">`.
- Never use `alert()`.

---

## Security

### Posture

- TLS everywhere: ACM cert on the ALB (TLS 1.3 minimum), `rds.force_ssl=1`
  on RDS, `lib/db.ts` connects over TLS to any `*.amazonaws.com` host.
- KMS encryption at rest: customer-managed keys for RDS, S3, Secrets
  Manager, CloudWatch.
- Secrets in Secrets Manager (KMS-encrypted) — DB password, JWT cookie
  secret. Never commit `.env*` files.
- AWS WAF on the ALB: managed CRS + SQLi + IP reputation rule groups;
  1000 req / 5 min rate limit per IP; tighter 50 req / 5 min on `/api/auth/*`.
- Cognito MFA required for every user.
- CloudTrail multi-region with five managed alarms (root login, console
  without MFA, IAM changes, KMS key deletion, trail disabled). Alerts go
  to `equitaselite-prod-security-alerts` SNS topic.
- pgaudit logs writes + DDL; `log_statement = ddl`; `log_connections /
  disconnections = 1`.

### Don'ts

- Don't `aws configure` long-lived access keys. SSO + OIDC only.
- Don't commit `prod.tfvars` or any `.env*`.
- Don't disable RDS deletion protection. If you really need to destroy
  the DB, take a manual snapshot first and re-enable protection on the
  replacement.
- Don't apply terraform with `-auto-approve` for unrelated drift.
- Don't skip CI gates (`--no-verify`).
- Don't put unencrypted PII in CloudWatch logs.

---

## AI agents

Agents working on the codebase follow [`AGENTS.md`](AGENTS.md). The
short version:

- The project is a Next.js 15 App Router app with TypeScript and pg.
  Read `src/lib/` to find the shared helpers before writing new ones.
- DB-backed routes use `query<T>()` / `queryOne<T>()` from `@/lib/db`
  with parameterized SQL — never string interpolation.
- Schema changes go in `nextjs/db/migrations/`. The runner applies them
  on each deploy.
- Auth is JWT cookies + middleware-injected `x-user-id` header. Don't
  trust client-sent identifiers.
- Tier checks go through `lib/membership.ts`. Don't hardcode tier names.
- Push to `master` deploys. Watch with `gh run watch`.

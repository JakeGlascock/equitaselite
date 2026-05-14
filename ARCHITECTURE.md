# ARCHITECTURE.md — Equitas Elite

System architecture for the production deployment at
[equitaselite.com](https://equitaselite.com).

---

## Overview

Equitas Elite is a Next.js 15 application running on AWS ECS Fargate behind
an Application Load Balancer, backed by RDS PostgreSQL 17 and AWS Cognito.
Everything is encrypted at rest with customer-managed KMS keys; every
inbound and outbound request is over TLS.

```
                                  Route 53
                                     │
                         equitaselite.com (ALIAS)
                                     │
                                     ▼
                              AWS WAF (rate-limit,
                              AWS Managed Rules)
                                     │
                                     ▼
                       Application Load Balancer (HTTPS,
                                ACM TLS 1.3)
                                     │
                                     ▼
                          ECS Fargate Service
                          (2-10 tasks, multi-AZ)
                          ┌────────────────────────────┐
                          │  Next.js 15 standalone     │
                          │  ┌──────────────────────┐  │
                          │  │ Middleware           │  │
                          │  │  - jose JWT verify   │  │
                          │  │  - x-user-id header  │  │
                          │  └──────────┬───────────┘  │
                          │             │              │
                          │  ┌──────────▼───────────┐  │
                          │  │ Server components +  │  │
                          │  │ Route handlers       │  │
                          │  └──────────┬───────────┘  │
                          │             │              │
                          │  ┌──────────▼───────────┐  │
                          │  │ src/lib (db, auth,   │  │
                          │  │ matches, membership) │  │
                          │  └──┬──────────┬────────┘  │
                          └─────│──────────│───────────┘
                                ▼          ▼
                       RDS Postgres 17    AWS services
                       (multi-AZ,         (Cognito, SES,
                        KMS, 35d PITR)     S3, Secrets Mgr)
```

## Runtime

| Component | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Server components keep DB queries server-side; route handlers cover the API surface |
| Runtime | Node 24 in the runner image, `next start` standalone output | Standalone trace ships only the deps actually used; small image |
| Container orchestration | ECS Fargate, 2-10 task auto-scaling | No EC2 hosts to manage; spreads across AZs |
| Front door | ALB + ACM (TLS 1.3) | Standard AWS pattern; ACM cert auto-renews via DNS |
| Edge filtering | AWS WAF | AWS managed rule groups (CRS, SQLi, IP reputation) + 1000 req/5min rate limit; 50 req/5min for `/api/auth/*` |
| Auth | Cognito User Pool with TOTP MFA | Invite-only via `AdminCreateUser`; first sign-in forces password set + MFA pairing |
| Database | RDS Postgres 17 (`db.t4g.medium` class) | Multi-AZ, gp3 storage, KMS encryption, 35-day PITR, IAM auth enabled, pgaudit + log_statement=ddl |
| Email | SES v2, domain identity for `equitaselite.com` | DKIM + SPF + DMARC (`p=quarantine; pct=25`); sender `noreply@equitaselite.com` |
| Object storage | S3 (KMS-encrypted) | Documents bucket + access logs bucket + CloudTrail bucket; all `BlockPublicAccess` |
| Secrets | AWS Secrets Manager (KMS) | DB password, JWT-verify cookie secret, etc. — never in env files |
| Observability | CloudWatch logs, Performance Insights, CloudTrail | Multi-region trail with five managed alarms (root login, no-MFA console, IAM changes, KMS key deletion, trail disabled) |

## Authentication flow

```
 ┌──────────┐   POST /api/auth/signin    ┌──────────┐
 │ /signin  │ ──────────────────────────▶│ Cognito  │
 │  page    │     {email, password}      │          │
 └──────────┘                            └────┬─────┘
      ▲                                       │
      │                ChallengeName?         │
      │     ┌─────────────────────────────────┤
      │     │                                 │
      │  NEW_PASSWORD                MFA_SETUP / SOFTWARE_TOKEN_MFA
      │     │                                 │
      │     ▼                                 ▼
      │   force new password         show QR (mfa_setup) or
      │   step                       prompt for 6-digit code (mfa)
      │     │                                 │
      │     └──────────────┬──────────────────┘
      │                    ▼
      │           Cognito issues
      │           access + id + refresh tokens
      │                    │
      └────────────────────┘
       Set as httpOnly cookies:
       ee_access, ee_id (1h), ee_refresh (30d)
```

After sign-in, every request hits `src/middleware.ts`, which:
1. Skips public paths (`/`, `/signin`, `/pricing`, `/request-access`, `/api/health`).
2. Verifies the `ee_id` cookie against the Cognito JWKS using `jose`.
3. Injects `x-user-id` and `x-user-email` headers into the downstream request.
4. Redirects to `/signin` if the JWT is missing or invalid.

Server components and route handlers read `x-user-id` from `headers()` /
`req.headers.get(...)`. There's no client-side auth state — the cookie is
the source of truth.

## Module structure

```
src/
  middleware.ts           # JWT verify + header injection
  app/
    layout.tsx            # Root layout (font, metadata, global CSS)
    page.tsx              # Marketing landing
    signin/               # Cognito sign-in + MFA flows
    pricing/              # Public pricing page (server-resolves current tier)
    request-access/       # Public access-request form
    onboarding/           # 4-step profile creation (validated client + server)
    (app)/                # All authenticated surfaces (shared AppShell layout)
      layout.tsx          # Loads profile, role, tier; renders AppShell
      dashboard/          # Match cards, intro CTA, tier banners
      profile/            # Self-edit profile
      connections/        # Inbound + outbound intro management
      admin/              # MembersTable, InviteForm, access-requests
      concierge/          # Managed accounts + "Operate as"
      insights/           # Tier-gated reports
      events/             # Tier-gated event RSVPs
      pricing/, …         # Other product pages
    api/
      auth/               # session, signin, signout, refresh
      me/                 # GET/PATCH the current profile
      onboarding/         # POST initial profile + tier=access
      matches/            # (read via lib/matches.ts from RSC, no API needed)
      introductions/      # POST + accept/decline + tier-limit enforcement
      notifications/      # mark-read, etc.
      concierge/          # Managed-profile CRUD + act-as cookie
      admin/              # Invite, seed-demo-data, users PATCH, access-requests
      health/             # 200 OK for smoke + ALB
      request-access/     # Public unauth POST
  lib/
    db.ts                 # pg Pool singleton, query<T>() / queryOne<T>() helpers
    auth.ts               # Cognito SDK wrappers (signIn, MFA, list/create users)
    admin.ts              # isUserAdmin() — DB-backed + env-var break-glass
    membership.ts         # Tier type, TIER_LIMITS, getTier, checkIntroQuota
    matches.ts            # getMe, getCandidates, buildIntroMap, toMatchView
    scoring.ts            # computeMatchScore (sector/stage/check/geography)
    acting-as.ts          # Concierge "operate as" cookie + getEffectiveUserId
    email.ts              # SES wrappers (intro events)
    aws.ts                # AWS SDK clients
  components/
    AppShell.tsx          # Top bar + left nav + acting-as banner + tier badge
    MatchCard.tsx         # Score ring + intro action
    NotificationsBell.tsx # Bell + dropdown + mark-read
  scripts/
    migrate.mjs           # DB migration runner (run as ECS one-off task)
    smoke.mjs             # Smoke checks against prod (run from GitHub Actions)
  db/
    migrations/           # 001-008 SQL files
    RESTORE.md            # Recovery playbook
```

## Data model

Single primary table: `profiles`. Identities come from Cognito (the
`sub` claim becomes `profiles.id`). Demo and concierge-managed accounts use
`demo_*` / `managed_*` ID prefixes and bypass Cognito.

```
profiles                          schema_migrations
├── id              PK            ├── version    PK
├── email           UNIQUE        ├── checksum
├── role            ENUM          └── applied_at
├── full_name
├── firm_name                     introductions
├── sectors, stages, geography    ├── id (uuid)
├── check_size_min/max            ├── requester_id  FK → profiles
├── risk_tolerance, …             ├── recipient_id  FK → profiles
├── is_admin                      ├── status        pending/accepted/declined
├── is_concierge                  ├── message
├── managed_by      FK → profiles ├── created_at
├── membership      access/select/sovereign
├── email_notifications_enabled   notifications
├── onboarding_completed          ├── id (uuid)
├── created_at                    ├── user_id   FK → profiles
└── updated_at                    ├── type, title, body
                                  ├── link_url, related_id
                                  └── is_read, created_at

access_requests
├── id (uuid)
├── email, full_name, firm_name, role, brief
├── status   new/contacted/onboarded/declined
└── created_at
```

`schema_migrations.checksum` protects against editing an applied migration —
the runner re-hashes each file and aborts the next deploy on mismatch.

## Match scoring

`computeMatchScore(user, candidate)` returns `{ total, sector, stage,
checkSize, geography, label }`. Weights: sector 40, stage 30, check size
20, geography 10. Total is capped at 99 (perfect-match would be 100; we
reserve that for hypothetical future cases).

`getCandidates(me)` runs the opposite-role query (`angel ↔ family_office`),
filters out concierges, and (now) selects `membership` so the dashboard
can sort with **priority placement** (Sovereign rows first, then Select,
then Access). Within a tier, results are sorted by score descending. The
dashboard then slices to the caller's tier limit (Access: 10; Select +
Sovereign: unlimited).

## Tier enforcement (Phase 0 + 1)

`src/lib/membership.ts` is the single source of truth:

```
                Access   Select       Sovereign
Matches/month   10       unlimited    unlimited
Intros/30d      0        5            unlimited
Priority rank   2        1            0
```

- `/api/introductions` POST calls `checkIntroQuota` first; over-quota
  returns `402` with `{ upgradeRequired, used, limit }`. The MatchCard's
  intro button is replaced with "Upgrade to introduce" on Access (and on
  Select-at-cap).
- The dashboard renders an upgrade banner when matches are capped or
  intros are exhausted.
- `/pricing` server-resolves the caller's tier and highlights the current
  plan; `/insights` and `/events` page-server resolves it and pass to the
  client, which renders lock overlays on items above the user's tier.

## Concierge / "Operate as"

A concierge (`profiles.is_concierge = TRUE`) can create managed-account
profiles (`managed_*` IDs, no Cognito account) on behalf of clients. The
"Operate as" button sets a server-readable `ee_acting_as` cookie scoped
to a single managed profile. `getEffectiveUserId(req)` and
`getActingAsState()` (in `lib/acting-as.ts`) return the impersonated id
when present and the lookup verifies the caller actually owns that
managed profile — stale cookies are silently ignored.

## Deploy pipeline

`.github/workflows/deploy.yml` triggers on push to `master` when
`nextjs/**`, `infrastructure/ecs.tf`, or `.github/workflows/deploy.yml`
changes. The job:

1. Builds the Docker image, pushes to ECR using the commit SHA as the
   tag (ECR has `IMMUTABLE` tag policy; the push step tolerates "already
   exists" if the same SHA was pushed by a prior failed run).
2. Registers a new task definition revision pointing at the new image.
3. Runs `nextjs/scripts/migrate.mjs` as a one-off Fargate task using the
   new task definition (command override). The task reuses the service's
   networkConfiguration so it lands in the same private subnets and SG.
   Deploy aborts on non-zero exit.
4. Updates the ECS service, waits for stable, hits `/api/health`.

OIDC to AWS uses the `equitaselite-github-deploy-prod` role; no
long-lived access keys exist.

## Smoke + alerts

`.github/workflows/smoke.yml` runs the smoke script after every
successful deploy (`workflow_run` trigger) and hourly (cron). On
failure, it assumes the same OIDC deploy role and calls SESv2
`send-email` to `alert@equitaselite.com` with the last 30 lines of
script output and a link to the workflow run.

Checks: `/api/health` JSON marker · `/`, `/signin`, `/pricing`,
`/request-access` body markers · `/dashboard` redirect to `/signin`.

## CI gates

`.github/workflows/ci.yml` runs on every push and PR:

- `tsc --noEmit` + `next lint`
- Vitest with 80% line/statement/function + 75% branch thresholds
- `npm audit --audit-level=high`
- Trivy container scan (HIGH + CRITICAL, fixed-only)
- Checkov Terraform scan (with a documented `skip_check` list)
- Gitleaks secret scan

Failures surface to the GitHub Security tab as SARIF.

## What's not in this architecture (yet)

- A read replica for analytics
- Cross-region backup copies
- Storage autoscaling on the RDS instance
- A scoped migration role (the runner currently uses the DB superuser)
- A staging environment (every deploy is straight to prod; smoke tests
  catch obvious breakage within ~30 seconds)

See [`PLANNING.md`](PLANNING.md) for the roadmap.

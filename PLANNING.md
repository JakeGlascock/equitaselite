# PLANNING.md — Equitas Elite

Roadmap, build status, and strategic priorities.

---

## Current state

Equitas Elite is a **live, production AWS application** at
[equitaselite.com](https://equitaselite.com). The core matching loop is end
to end on real data: Cognito-authenticated sign-in with TOTP MFA, a 4-step
onboarding wizard, server-side scored matches, intro requests with email
notifications, three membership tiers with real enforcement, and a
concierge "operate as" flow.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for system architecture and
[`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md) for the deploy
runbook.

### Build status

| Area | Status |
|---|---|
| Sign-in (Cognito + TOTP MFA, NEW_PASSWORD + MFA_SETUP flows) | ✅ Live |
| Invitation flow (Cognito `AdminCreateUser` from `/admin`) | ✅ Live |
| Onboarding (4 steps, client + server validation, required fields) | ✅ Live |
| Profile self-edit (`/profile`, reuses onboarding form in edit mode) | ✅ Live |
| Match scoring (`computeMatchScore`, sector / stage / check / geography) | ✅ Live |
| Dashboard (ranked matches, MatchCard, score ring, tier banners) | ✅ Live |
| Introductions (request, accept, decline, message, contact reveal) | ✅ Live |
| Notifications (in-app bell + mark-read) | ✅ Live |
| Email notifications via SES (intro requested / accepted / declined) | ✅ Live |
| Pricing page with current-plan highlight | ✅ Live |
| Tier enforcement (match cap, intro cap, priority placement) | ✅ Live |
| Tier-gated `/insights` (locked rows + upgrade CTA) | ✅ Live |
| Tier-gated `/events` (locked rows + upgrade CTA) | ✅ Live |
| Concierge role (managed accounts + "Operate as" cookie) | ✅ Live |
| Admin (`/admin`: invite, members table, tier dropdown, access requests) | ✅ Live |
| Access requests (public `/request-access` → `access_requests` table + SES) | ✅ Live |
| Automated DB migration runner (ECS one-off task per deploy) | ✅ Live |
| Smoke tests + email alerts to `alert@equitaselite.com` (deploy + hourly) | ✅ Live |
| GitHub OIDC + scoped deploy role (no long-lived AWS keys) | ✅ Live |
| Brand-aligned SES sender (DKIM + SPF + DMARC `p=quarantine; pct=25`) | ✅ Live |
| 35-day PITR + multi-AZ RDS + KMS encryption + deletion protection | ✅ Live |
| Recovery runbook (`nextjs/db/RESTORE.md`) | ✅ Live |
| Tests: vitest unit (scoring, matching, membership, acting-as, auth) | ✅ Live |
| CI gates: tsc + lint + audit + Trivy + Checkov + Gitleaks | ✅ Live |

### Static / mock surfaces

These pages exist in the app shell but their content is hardcoded — they
exist mostly to tease the value of higher tiers:

| Surface | Status | Notes |
|---|---|---|
| `/insights` reports | ⚠️ Static | Hardcoded `REPORTS` array; tier-gated UI is real |
| `/events` listings | ⚠️ Static | Hardcoded `UPCOMING` + `PAST`; tier-gated UI is real |
| `/portfolio` view | ✅ DB-backed | Shows intro history as the proxy "deal pipeline" |
| `/connections` | ✅ DB-backed | Real intro state |
| `/network` | ⚠️ Static | Stub page |
| `/reports` | ⚠️ Static | Stub page |
| `/discovery` | ⚠️ Static | Stub page |
| Relationship-manager assignment | ⚠️ Hardcoded | Single "Olivia Marchetti" shown to all non-concierges |

---

## Pricing roadmap (the live build plan)

Five-phase plan for turning the `/pricing` page into truthful, enforced
functionality. The `membership` column on `profiles` exists; phases 0-2 are
done.

### Phase 0 — Tier-assignment plumbing ✅
- [x] Admin sets a user's tier from MembersTable (dropdown like Managed-by)
- [x] `PATCH /api/admin/users/[id]` extended with `membership`
- [x] Self-onboards default to `'access'`
- [ ] Stripe self-serve upgrades (future; current path is admin grants)

### Phase 1 — Server-side enforcement ✅
- [x] `lib/membership.ts` with `getTier(userId)` + `TIER_LIMITS`
- [x] Match cap: Access slice to 10 (banner with upgrade CTA)
- [x] Intro cap: Access blocked, Select capped at 5/30d, Sovereign unlimited
- [x] Priority placement: candidate's tier ranks before score in dashboard sort
- [x] Upgrade-CTA banner on 402 responses + on-card "Upgrade to introduce"

### Phase 2 — Tier surfacing in the UI ✅
- [x] Tier pill badge in the top-nav, links to `/pricing`
- [x] Current-plan highlight on `/pricing`
- [x] Lock-icon overlays on `/insights` and `/events` for items above tier
- [x] Contextual CTA — Upgrade / Contact us / Current plan

### Phase 3 — Email deal alerts
Last gap on the Access tier feature list.
- [ ] `match_digest_state` table (`user_id`, `last_sent_at`)
- [ ] Weekly EventBridge → Lambda → `/api/cron/match-digest` (shared-secret)
- [ ] Find new matches since `last_sent_at`, email via SES
- [ ] Respect existing `email_notifications_enabled`
- [ ] Optional cadence per tier (weekly Access, daily Sovereign)

### Phase 4 — Human-touch features made real
Currently hardcoded mocks; need real DB-backed flows.
- [ ] **Real RM assignment** — `relationship_manager_id` column on profiles;
  admin assigns; `/concierge` reads it (fallback Olivia for non-Sovereign).
- [ ] **Summit RSVP** — `events` + `event_rsvps` tables; admin creates events
  with `min_tier`; user RSVPs from `/events`.
- [ ] **Sovereign onboarding queue** — concierge dashboard surfaces new
  Select+ / Sovereign signups in "needs welcome" state.

### Phase 5 — Real content & analytics
Largest scope. Content + design.
- [ ] `reports` table + admin CMS for sector reports
- [ ] "Bespoke portfolio intelligence" — analyst-written or LLM-generated
  per-Sovereign weekly memo, stored in `portfolio_reports`
- [ ] Mandate analytics dashboard (intro acceptance rates by sector,
  mandate density heatmap)

---

## Infrastructure / operational backlog

Independent of the pricing build. Cheap-to-medium effort, real safety wins.

- [ ] **Storage autoscaling on RDS** — add `max_allocated_storage = 500` to
  `aws_db_instance.main`. Prevents write failures when usage approaches the
  100 GB allocation.
- [ ] **Cross-region backup copies** — automated snapshot copy from us-east-1
  to us-west-2 via EventBridge + Lambda. DR readiness against a regional
  outage.
- [ ] **Dedicated migration role** — `migrate_role` granted `CREATE`,
  `ALTER`, `ADD COLUMN` but NOT `DROP TABLE` / `TRUNCATE`. Defends against
  destructive migrations.
- [ ] **DMARC ratchet** — move from `p=quarantine; pct=25` to `pct=100`,
  then `p=reject` after a few weeks of clean aggregate reports at
  `dmarc-reports@equitaselite.com`.
- [ ] **Staging environment** — second VPC + ECS service + RDS, deployed
  on every push and used for the smoke tests before prod. Probably needed
  before any "risky" schema migrations.
- [ ] **Secrets rotation** — Secrets Manager rotation Lambda for the DB
  password.
- [ ] **Read replica for analytics** — once Phase 5 content / analytics
  generation makes heavy reads.
- [ ] **`tfplan` parameter-group drift** — investigate the `rds.force_ssl`
  `apply_method` drift before the next blanket `terraform apply`.

---

## Product backlog (non-tier)

- [ ] **Match detail page** — `/match/[id]` deep dive with full mandate,
  untruncated sectors, recent activity timeline, prominent intro CTA. ~2h.
- [ ] **Match explanations** — plain-language summary of why a score is
  what it is; "Why not 100?" tooltip on the score ring.
- [ ] **User-controlled match preferences** — sliders that adjust the
  scoring weights for their own view of matches.
- [ ] **Document vault** — wire up the existing S3 bucket to a real upload
  + signed-URL flow per intro.
- [ ] **Real-time messaging** — chat in `/connections` once an intro is
  accepted, on top of Postgres LISTEN/NOTIFY or a Lambda-fronted WebSocket.

---

## Closed questions

- **Hosting model:** AWS in `us-east-1`. (Considered Supabase + Vercel
  during prototype phase; chose AWS for institutional credibility +
  SOC 2 / ISO 27001 path.)
- **Auth provider:** AWS Cognito with required TOTP MFA. (No SSO yet —
  added if family-office IT teams ask.)
- **Schema migration tool:** in-repo SQL files + a custom ECS-task runner
  with checksum verification. (Considered Flyway / sqlx-migrate; the
  custom runner is ~120 lines and matches our needs.)
- **Data layer:** PostgreSQL 17 (RDS, multi-AZ, KMS, 35d PITR). Single
  primary table `profiles`; intros, notifications, access_requests are
  reference tables keyed off it.

---

## Open questions

- **Regulatory classification** — does the platform constitute investment
  advice or act as a broker-dealer under US law? Needs legal sign-off
  before transaction revenue (success fees, syndicate carry) is built.
- **Data residency** — EU/UK family-office users may require EU data
  residency. Would require either a second deployment in `eu-west-1` or
  a feature flag on user creation.
- **Pricing-tier billing** — admin-grants today, Stripe integration is the
  obvious next step but adds compliance scope (PCI). Could defer until
  a paying user explicitly asks.
- **Founder profiles** — a third user type ("company / founder") for deal-
  flow sourcing was sketched in the original roadmap. Investor↔investor
  is the current scope. Out of plan until 50+ paying members.
- **Mobile** — institutional audience usually has executive assistants who
  handle on-the-go work. Native app probably not needed; mobile-web is
  the priority. Validate with the first 10 paying members.

# SKILL.md — Equitas Elite

Reusable recipes for common changes to the Next.js codebase. Each skill is
a concrete, copy-paste-ready prompt that produces a predictable result.

---

## Add an authenticated page

```
Create a new authenticated page called `/[route]` for Equitas Elite.

Requirements:
- Lives at nextjs/src/app/(app)/[route]/page.tsx
- Server component by default. Resolve the caller via `headers().get('x-user-id')`;
  use `getEffectiveUserId(req)` instead in route handlers.
- Add it to the sidebar nav (NAV_ITEMS) or top nav (TOP_NAV_ITEMS) in
  nextjs/src/components/AppShell.tsx, with a Material Symbols icon name.
- Match the existing page header pattern:
    <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">{eyebrow}</p>
    <h1 className="font-display text-3xl text-ee-gold mt-1">{title}</h1>
    <p className="text-ee-muted text-sm mt-1">{subtitle}</p>
- Wrap content cards in `glass-panel`.
- Tier-gate where appropriate by resolving the caller's tier with
  `getTier(userId)` from @/lib/membership and rendering lock overlays
  on items above the tier.

Page purpose: [describe what the page should show]
```

## Add a schema change

```
Add a schema migration to Equitas Elite.

Requirements:
- File at nextjs/db/migrations/0NN_short_name.sql (next available number).
- Idempotent DDL only — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`. For triggers, drop-then-create:
    DROP TRIGGER IF EXISTS x ON table; CREATE TRIGGER x ...
- Never edit an existing migration. The runner re-hashes every file on
  every deploy and aborts on checksum mismatch.
- The migration runner applies it automatically on the next deploy
  (ECS one-off Fargate task). No /admin button required.

What the migration should change: [describe schema change]
```

## Add a route handler

```
Add a route handler to Equitas Elite.

Requirements:
- File at nextjs/src/app/api/[path]/route.ts.
- Export GET / POST / PATCH / DELETE handlers as needed.
- Resolve the caller via `getEffectiveUserId(req)` from @/lib/acting-as
  (it honors the concierge "Operate as" cookie).
- Validate input with zod. On invalid input return NextResponse.json
  with a flat string error and HTTP 400.
- Use `query<T>()` / `queryOne<T>()` from @/lib/db with parameterized SQL.
  Never string-interpolate user input.
- For admin endpoints, gate on `isUserAdmin(userId, userEmail)` from @/lib/admin.
- Return NextResponse.json with appropriate status: 200/201 ok, 401 unauth,
  402 quota-exceeded (with `upgradeRequired`), 403 forbidden, 404 not found.

Endpoint behaviour: [describe]
```

## Add an admin action

```
Add an admin-only operation to Equitas Elite.

Requirements:
- Route handler at nextjs/src/app/api/admin/[op]/route.ts.
- Gate on `isUserAdmin(userId, userEmail)` first thing. Return 403 on failure.
- Surface the action in nextjs/src/app/(app)/admin/page.tsx or its
  MembersTable client component as appropriate.
- If the action is destructive (delete user, etc.), require confirmation
  in the client — don't just fire on click.
- Log the action: insert a row into a forthcoming `admin_actions` audit
  table, OR (interim) console.log with `[admin]` prefix.

Action: [describe]
```

## Add a tier-gated feature

```
Add a tier-gated feature to Equitas Elite.

Requirements:
- Source-of-truth for tier limits is nextjs/src/lib/membership.ts —
  extend TIER_LIMITS, getLimits(tier), etc. if a new dimension is needed.
- Server-side enforcement: resolve `await getTier(userId)` and check
  before doing the work. Reject with 402 + { upgradeRequired: 'select' | 'sovereign' }
  for tier-gated APIs.
- Client-side surface: show the feature but render an "Upgrade to X"
  CTA (linking /pricing) instead of the active control when the tier
  is too low. See nextjs/src/components/MatchCard.tsx's `canSendIntros`
  prop for the pattern.
- Pricing page should reflect the feature — update PLANS in
  nextjs/src/app/pricing/PricingClient.tsx so each tier's feature list
  is accurate.

Feature: [describe]
```

## Add a notification

```
Add a notification trigger to Equitas Elite.

Requirements:
- In-app: insert a row in `notifications` (user_id, type, title, body,
  link_url, related_id). Wrap in try/catch — pre-init the table may not
  exist; don't fail the parent operation.
- Email: add a new helper in nextjs/src/lib/email.ts that calls
  SESv2 send-email. Gate on the recipient's
  `email_notifications_enabled` column.
- The NotificationsBell component picks up the new row automatically;
  no client changes needed.

Trigger: [describe when this should fire]
Email body: [optional template]
```

## Add a smoke check

```
Extend the smoke runner to cover a new critical path.

Requirements:
- Edit nextjs/scripts/smoke.mjs's CHECKS array.
- For a GET endpoint that requires no auth, add { name, path, status, contains }.
- For an auth-gated path that should redirect, use { status: [302,307,308],
  redirectContains: '/signin', followRedirect: false }.
- Pick a marker string that's specific to the page and unlikely to
  appear anywhere else (e.g., a heading or unique form label).
- The check runs on every deploy + hourly cron + manual dispatch.
- A failure emails alert@equitaselite.com via SES automatically.

Path to add: [path] · Why it's critical: [reason]
```

## Add a test

```
Add a vitest unit test to Equitas Elite.

Requirements:
- File at nextjs/src/lib/__tests__/[file].test.ts (mirroring the SUT path).
- Use vi.mock for any DB dependency: `vi.mock('@/lib/db', () => ({ ... }))`.
- For mocked rejections, prefer mockRejectedValueOnce over
  mockRejectedValue — vitest's unhandled-rejection tracker is more
  forgiving with the "Once" variant.
- Coverage threshold is 80% line/statement/function, 75% branch.
- DB-backed and AWS-SDK-backed modules (auth.ts, email.ts, admin.ts,
  db.ts) are excluded from coverage via vitest.config.ts — don't try
  to unit-test them, write integration tests instead.

What to test: [describe SUT and cases]
```

## Add a feature page to the marketing site

```
Add or update a section on the public marketing site at /.

Requirements:
- Edit nextjs/src/app/page.tsx (the unauthenticated landing).
- Keep the brand voice: institutional, restrained, no exclamation points,
  no marketing-speak ("revolutionary", "game-changing", etc.).
- All hex colors must come from the ee-* token set (see DESIGN.md).
- Material Symbols for icons; never inline SVG glyphs.
- All CTAs should route to /request-access for unauthenticated visitors,
  not mailto: links.
- Tier names are Access, Select, Sovereign — match those exactly.

Section: [describe]
```

---

## Working in this codebase

- The Next.js standalone server forces `NODE_ENV=production` regardless
  of what ECS sets. Don't rely on `NODE_ENV` for behaviour decisions in
  scripts that run outside Next.js (use other signals — DB_HOST for
  TLS, `process.env.AWS_REGION` for region, etc.).
- The migration runner runs as the DB superuser today. Future work to
  scope it down is in PLANNING.md.
- For ECR retries, the deploy workflow tolerates "tag invalid: already
  exists" because the IMMUTABLE policy rejects re-pushes of the same
  SHA. Don't `--force` your way around this — it's load-bearing.
- The `infrastructure/.gitignore` keeps `prod.tfvars` and `tfplan` out
  of git. Both contain real account-specific values.
- `/api/health` is the only DB-free endpoint. Useful for smoke and
  load-balancer health checks; don't add DB queries to it.

For first-time deploy steps, see [`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md).
For DB recovery, see [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md).
For per-feature roadmap, see [`PLANNING.md`](PLANNING.md).

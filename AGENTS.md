# AGENTS.md — Equitas Elite

Instructions for AI agents (Claude Code, Cursor, etc.) working on this
codebase.

---

## What this is

Equitas Elite is a Next.js 15 application running on AWS in production at
[equitaselite.com](https://equitaselite.com). The app lives in `nextjs/`,
infrastructure-as-code in `infrastructure/` (Terraform). Top-level
`*.html` files are historical prototype artifacts — not served in
production, not worth touching.

Before doing meaningful work, read:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system design + module structure
- [`PROTOCOL.md`](PROTOCOL.md) — day-to-day procedures + don'ts
- [`PLANNING.md`](PLANNING.md) — what's built, what's planned
- [`SKILL.md`](SKILL.md) — copy-paste recipes for common changes

---

## Architecture rules

### The shared library is the source of truth

`nextjs/src/lib/` holds every cross-cutting helper. Don't duplicate
behaviour into a route or component — extend the lib.

| Module | Purpose |
|---|---|
| `db.ts` | pg Pool singleton, `query<T>()` / `queryOne<T>()` helpers |
| `auth.ts` | Cognito SDK wrappers (sign-in, MFA, list/create users) |
| `admin.ts` | `isUserAdmin(userId, userEmail)` (DB-backed + env break-glass) |
| `membership.ts` | `Tier`, `TIER_LIMITS`, `getTier()`, `checkIntroQuota()` |
| `matches.ts` | `getCandidates`, `buildIntroMap`, `toMatchView` |
| `scoring.ts` | `computeMatchScore` — pure, well-tested |
| `acting-as.ts` | Concierge "Operate as" cookie + `getEffectiveUserId(req)` |
| `email.ts` | SES wrappers for intro notifications |

If a route needs to know the caller's id, get it from
`getEffectiveUserId(req)` or `await headers().then(h => h.get('x-user-id'))`
— **never trust a client-sent identifier**.

### Migrations are append-only

Schema changes go in `nextjs/db/migrations/0NN_short_name.sql`. The
automated migration runner applies them on every deploy. Hard rules:

- **Always idempotent.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
  EXISTS`, `CREATE INDEX IF NOT EXISTS`. For triggers without IF NOT
  EXISTS, drop-then-create.
- **Never edit an applied migration.** The runner records each file's
  SHA-256 and aborts deploys on mismatch. To fix a previous migration,
  write a new one that corrects forward.
- **Lexical order matters.** Use zero-padded prefixes (008, not 8).

### Parameterized SQL only

```ts
// Good
await query<Profile>('SELECT * FROM profiles WHERE id = $1', [userId])

// Never
await query<Profile>(`SELECT * FROM profiles WHERE id = '${userId}'`)
```

The `pg` library handles parameterization safely; raw interpolation is
SQL injection waiting to happen.

### Server components by default

`nextjs/src/app/(app)/*/page.tsx` are server components. They query the
DB directly (via `lib/`) and pass typed props to client components for
interactivity. Don't reach for `'use client'` unless you actually need
state, effects, or browser-only APIs.

### Auth happens once, in middleware

`nextjs/src/middleware.ts` verifies the Cognito JWT and injects
`x-user-id` and `x-user-email` headers. Server components and route
handlers just read those headers. There's no per-page auth check.

### Tier checks go through `lib/membership.ts`

Don't hardcode `if (tier === 'sovereign')` in random places. Use
`getLimits(tier)`, `checkIntroQuota(userId)`, `priorityRank(tier)`. If
a new dimension is needed, add it to `TIER_LIMITS`.

---

## Design rules

The design system is in [`DESIGN.md`](DESIGN.md). The Next.js app
implements it via Tailwind tokens.

### Colors

Never introduce a new hex value. Use the `ee-*` token classes:

| Intent | Class |
|---|---|
| Page background | `bg-ee-bg` |
| Content card | `glass-panel` (preset utility) |
| Gold accent (CTAs, current-plan, Select tier) | `text-ee-gold` / `bg-ee-gold` |
| Emerald accent (success, top-score, Sovereign tier) | `text-ee-emerald` |
| Primary text | `text-ee-primary` |
| Muted text | `text-ee-muted` |
| Border | `border-ee-border` |

### Typography

| Use | Class |
|---|---|
| Page / section titles | `font-display` |
| Body | default |
| Numbers, monospace chips, labels | `font-data` |

### Icons

Material Symbols Outlined:
```tsx
<span className="material-symbols-outlined text-lg">handshake</span>
```

Never inline raw SVG path data for icons that exist in Material Symbols.

### Patterns

- Every content card is a `glass-panel`.
- Interactive elements need a 44px touch target (use the `btn-*` utility
  set or matching padding).
- Never use `alert()`. Use the notifications + inline error patterns.

---

## Workflow

### Don'ts

- ❌ Don't commit `.env*`, `prod.tfvars`, `tfplan`, or anything with real
  AWS account IDs (except in `.github/workflows/*` where it's intentional).
- ❌ Don't `terraform apply` without first running `terraform plan` and
  reviewing the diff. Use `-target=<resource>` when there's unrelated
  drift.
- ❌ Don't disable RDS deletion protection.
- ❌ Don't push commits whose subject is "WIP" or "Update README". Be
  specific about what changed and why.
- ❌ Don't bypass CI gates with `--no-verify`.
- ❌ Don't string-interpolate user input into SQL.
- ❌ Don't add a `console.log` to production code paths.

### Do

- ✅ Use the migration runner for schema changes. No more `/admin` init
  buttons.
- ✅ Write a vitest unit test for any new pure function in `lib/`.
- ✅ Watch a deploy after pushing (`gh run watch`). If smoke fails after
  deploy, fix forward immediately — `alert@equitaselite.com` gets an
  email otherwise.
- ✅ Read PROTOCOL.md before changes to deploy / migrations / auth.
- ✅ Update PLANNING.md when you ship something it claimed was pending.

### Deploys

Push to `master` ships to production. The Deploy workflow:
1. Builds + pushes the image (ECR SHA tag, immutable, idempotent on retry).
2. Registers a new task-def revision.
3. Runs DB migrations as an ECS one-off Fargate task.
4. Rolls the service, waits for stable, hits `/api/health`.

A typical deploy is ~4–5 minutes. Smoke tests fire automatically after
every successful deploy (and hourly via cron). Failures email
`alert@equitaselite.com`.

---

## Things AI agents specifically get wrong

- **Hardcoding tier names.** Always import from `lib/membership.ts`.
- **Adding a new migration that drops or alters an existing one.** If
  you need to change a previous migration's intent, write a new file
  that does the corrective work — never edit history.
- **Calling lib/db.ts from a client component.** `pg` doesn't work in
  the browser; the build will fail. Keep DB queries in server components
  or route handlers.
- **Forgetting the `acting-as` cookie.** Code that uses
  `headers().get('x-user-id')` directly bypasses the concierge
  "Operate as" flow. Use `getEffectiveUserId(req)` /
  `getActingAsState()` for any user-data fetch.
- **Adding a new top-level `*.html` file.** Those are historical
  artifacts. New pages go in `nextjs/src/app/`.
- **Using `mockRejectedValue` (persistent) in vitest tests.** Use
  `mockRejectedValueOnce` — the persistent variant leaks unhandled
  rejections into vitest's tracker even when the production code
  catches them.

---

## Quick reference

- App: `nextjs/src/app/`
- Components: `nextjs/src/components/`
- Shared library: `nextjs/src/lib/`
- Migrations: `nextjs/db/migrations/`
- Scripts (migrate, smoke): `nextjs/scripts/`
- Tests: `nextjs/src/**/__tests__/`
- Infra: `infrastructure/*.tf`
- Workflows: `.github/workflows/`

For first-time deploy: [`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md)
For DB recovery: [`nextjs/db/RESTORE.md`](nextjs/db/RESTORE.md)
For repeat recipes: [`SKILL.md`](SKILL.md)

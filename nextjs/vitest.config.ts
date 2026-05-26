import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Coverage measures the libraries and unit-testable route handlers.
      // Pages and components are exercised by the production smoke job;
      // scripts/ has its own dedicated test file; middleware's pure helper
      // is unit-tested (see __tests__/middleware.test.ts) but the
      // jose-backed verify path lives outside this measured scope.
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: [
        'src/test/**',
        // AWS SDK wrappers — require live AWS credentials; tested via integration tests
        'src/lib/auth.ts',
        'src/lib/aws.ts',
        // pg Pool singleton — requires live DB; tested via integration tests
        'src/lib/db.ts',
        // SES sender — requires live AWS credentials + verified domain identity
        'src/lib/email.ts',
        // Admin check helper — requires live DB
        'src/lib/admin.ts',
        // Session helper — calls jose JWKS over the network; integration-tested
        'src/lib/session.ts',
        // Reports lib — thin pg query wrappers + a small pure helper;
        // integration-tested via the admin CMS + /reports flow
        'src/lib/reports.ts',
        // Portfolio-reports (bespoke briefings) — same pattern
        'src/lib/portfolio-reports.ts',
        // Deal-flow lib — thin pg query wrappers; integration-tested via
        // the admin CMS + /deals member flow
        'src/lib/deals.ts',
        // Analytics — pure SQL aggregations over real prod data; integration only
        'src/lib/analytics.ts',
        // Thin Cognito proxy routes — call signIn/signOut/refreshTokens from lib/auth.
        // signin/** moved into the measured scope as the Phase T0 reference test;
        // signout + refresh stay excluded until Phase T1 lands tests for them.
        'src/app/api/auth/signout/**',
        'src/app/api/auth/refresh/**',
        // Trivial 3-line health endpoint
        'src/app/api/health/**',
        // DB-backed routes — require live DB; tested via integration tests
        'src/app/api/me/**',
        'src/app/api/onboarding/**',
        'src/app/api/matches/**',
        // introductions/** moved into scope in Phase T1 (tier quota enforcement
        // is load-bearing for revenue; user_id scoping is security-shaped).
        'src/app/api/notifications/**',
        'src/app/api/request-access/**',
        'src/app/api/concierge/**',
        'src/app/api/walkthrough/**',
        // Admin route calls Cognito Admin API; tested via integration tests.
        // Specific subpaths covered in T1:
        //   - admin/users/[id] (self-revoke lockout + demo blocks)
        //   - admin/deals/[id]/invitations (Sovereign-only filter)
        // Keep the broad exclude for the rest; pull more in during T2.
        'src/app/api/admin/access-requests/**',
        'src/app/api/admin/backfill-placeholders/**',
        'src/app/api/admin/deck-tokens/**',
        'src/app/api/admin/deals/route.ts',
        'src/app/api/admin/events/**',
        'src/app/api/admin/invite/**',
        'src/app/api/admin/managed/**',
        'src/app/api/admin/portfolio-reports/**',
        'src/app/api/admin/preview-tokens/**',
        'src/app/api/admin/reports/**',
        'src/app/api/admin/seed-demo-data/**',
        'src/app/api/admin/test-fixtures/**',
        // Investor-preview cookie clear; trivial DB-less wrapper
        'src/app/api/preview/**',
        // User-feedback report — DB-backed + SES; integration-tested only
        'src/app/api/feedback/**',
        // Demo magic-link mail — SES sender, like email.ts
        'src/lib/demo-mail.ts',
        // Mandate sub-table — DB queries only
        'src/lib/mandates.ts',
        // Turnstile verify — network call to Cloudflare
        'src/lib/turnstile.ts',
        // Push dispatch — AWS SNS + DB
        'src/lib/push.ts',
        // Native client helpers — browser-only Capacitor wrappers
        'src/lib/native.ts',
        // Device-token endpoints — DB-backed + AWS SNS via lib/push
        'src/app/api/devices/**',
        // Member-facing deal-flow endpoints — DB-backed.
        // /api/deals/[id]/respond moved into scope in Phase T1 (user_id
        // scoping is security-shaped). The list route stays excluded for T2.
        'src/app/api/deals/route.ts',
        // Public demo signup — DB-backed + Turnstile + SES
        'src/app/api/demo/**',
        // Unsubscribe + events RSVP — DB-backed
        'src/app/api/unsubscribe/**',
        // Forgot/reset-password — thin Cognito wrappers from lib/auth
        'src/app/api/auth/forgot-password/**',
        'src/app/api/auth/reset-password/**',
        // Session endpoint — calls into excluded lib/session.ts
        'src/app/api/auth/session/**',
        // Passkey ceremony + management routes — Cognito Admin WebAuthn
        // API + the WebAuthnConfig pool quirk make these integration-only.
        // signin + register/complete moved into scope in Phase T1.
        'src/app/api/auth/passkey/list/**',
        'src/app/api/auth/passkey/register/start/**',
        'src/app/api/auth/passkey/[id]/**',
      ],
      // Ratcheted up from 80/75 — current measured coverage on the included
      // scope (src/lib/** + src/app/api/**, minus the AWS/DB-backed excludes)
      // is 100% lines/functions/statements and 99% branches, so we have plenty
      // of headroom. Tightening these protects against accidental regressions
      // when new untested code lands in lib/ or api/.
      thresholds: {
        lines:      90,
        functions:  90,
        branches:   85,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

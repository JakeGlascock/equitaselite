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
        // Admin check helper — env-fallback vs DB-column precedence
        // covered in T2 lib/__tests__/admin.test.ts.
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
        // Thin Cognito proxy routes — moved into scope in T0/T1/T2.
        // Trivial 3-line health endpoint
        'src/app/api/health/**',
        // DB-backed routes — require live DB; tested via integration tests.
        // me/**, onboarding/**, matches/**, notifications/** moved into scope
        // in Phase T2. concierge/act-as/** also covered in T2.
        // Admin CRUD routes — bulk pulled into scope in T2 (part 3). The
        // two largest (deck-tokens, seed-demo-data) stay excluded — they're
        // mostly boilerplate that benefits less from coverage measurement.
        'src/app/api/admin/deck-tokens/**',
        'src/app/api/admin/seed-demo-data/**',
        // Investor-preview cookie clear; trivial DB-less wrapper
        'src/app/api/preview/**',
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
        // Unsubscribe + events RSVP — existing tests cover them; pull the
        // route into the measured scope now.
        'src/app/api/unsubscribe/legacy-exclude-noop/**',
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

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
        // RSS surface loader — thin pg query wrapper; tested via integration
        'src/lib/rss-surface.ts',
        // Thin Cognito proxy routes — call signIn/signOut/refreshTokens from lib/auth
        'src/app/api/auth/signin/**',
        'src/app/api/auth/signout/**',
        'src/app/api/auth/refresh/**',
        // Trivial 3-line health endpoint
        'src/app/api/health/**',
        // DB-backed routes — require live DB; tested via integration tests
        'src/app/api/me/**',
        'src/app/api/onboarding/**',
        'src/app/api/matches/**',
        'src/app/api/introductions/**',
        'src/app/api/notifications/**',
        'src/app/api/request-access/**',
        'src/app/api/concierge/**',
        'src/app/api/walkthrough/**',
        // Admin route calls Cognito Admin API; tested via integration tests
        'src/app/api/admin/**',
        // DB-backed event RSVP + unsubscribe routes; tested via integration tests
        'src/app/api/events/**',
        'src/app/api/unsubscribe/**',
        // Investor-preview cookie clear; trivial DB-less wrapper
        'src/app/api/preview/**',
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

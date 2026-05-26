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
        // pg Pool singleton — requires live DB; integration-tested
        'src/lib/db.ts',
        // AWS SDK client singletons — pure construction, no logic to cover
        'src/lib/aws.ts',
        // Session helper — calls jose JWKS over the network; integration-tested
        'src/lib/session.ts',
        // Thin DB query wrappers — integration-tested via their callers
        'src/lib/reports.ts',
        'src/lib/portfolio-reports.ts',
        'src/lib/deals.ts',
        // Pure SQL aggregations over prod data; integration-only
        'src/lib/analytics.ts',
        // Native client helpers — browser-only Capacitor wrappers
        'src/lib/native.ts',
        // Trivial 3-line health endpoint
        'src/app/api/health/**',
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

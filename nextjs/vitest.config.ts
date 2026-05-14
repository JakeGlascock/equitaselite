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
        // Admin route calls Cognito Admin API; tested via integration tests
        'src/app/api/admin/**',
      ],
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

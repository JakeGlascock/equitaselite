import { describe, it, expect } from 'vitest'
import { isPublic } from '../middleware'

// isPublic is the only piece of the middleware we can exercise without
// mocking jose's remote JWKS fetch and constructing a full NextRequest.
// It also happens to be the security-critical part: every path the
// function returns true for is accessible without a Cognito session.
describe('middleware: isPublic', () => {
  describe('exact public paths', () => {
    it.each([
      '/',
      '/signin',
      '/pricing',
      '/request-access',
      '/unsubscribe',
      '/privacy',
      '/preview-denied',
    ])('treats %s as public', (path) => {
      expect(isPublic(path)).toBe(true)
    })
  })

  describe('public asset prefixes', () => {
    it.each([
      '/_next/static/chunks/main.js',
      '/_next/image?url=...',
      '/favicon.ico',
      '/logo.png',
    ])('treats %s as public', (path) => {
      expect(isPublic(path)).toBe(true)
    })
  })

  describe('public API prefixes', () => {
    it.each([
      '/api/auth/signin',
      '/api/auth/signout',
      '/api/auth/refresh',
      '/api/auth/session',
      '/api/health',
      '/api/request-access',
      '/api/unsubscribe',
      '/api/preview/clear',
      '/api/feedback/report',
    ])('treats %s as public', (path) => {
      expect(isPublic(path)).toBe(true)
    })
  })

  describe('preview-token entry paths', () => {
    it.each([
      '/preview/abc123',
      '/preview/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ])('treats %s as public (token gate runs in the page itself)', (path) => {
      expect(isPublic(path)).toBe(true)
    })
  })

  describe('authenticated paths must NOT be public', () => {
    it.each([
      '/dashboard',
      '/profile',
      '/admin',
      '/admin/access-requests',
      '/concierge',
      '/match/abc-123',
      '/insights',
      '/events',
      '/connections',
      '/portfolio',
      '/api/me',
      '/api/onboarding',
      '/api/introductions',
      '/api/introductions/abc-123',
      '/api/notifications',
      '/api/admin/users/abc',
      '/api/admin/seed-demo-data',
      '/api/concierge/profiles',
    ])('treats %s as private (requires auth)', (path) => {
      expect(isPublic(path)).toBe(false)
    })
  })

  describe('boundary cases', () => {
    it('does not treat a path that *contains* "/signin" but is not exactly "/signin" as public', () => {
      expect(isPublic('/admin/signin-overrides')).toBe(false)
      expect(isPublic('/signin-help')).toBe(false)
    })

    it('does not treat a similarly-spelled path as public', () => {
      expect(isPublic('/Pricing')).toBe(false)  // case-sensitive
      expect(isPublic('/pricinG')).toBe(false)
    })

    it('does not treat /api/auth-fake as public (prefix match, not contains)', () => {
      // /api/auth/ has the trailing slash so /api/authfake would NOT match
      expect(isPublic('/api/authfake')).toBe(false)
      expect(isPublic('/api/authmagic')).toBe(false)
    })

    it('does not treat a path that just starts with "/" as public unless it matches exactly', () => {
      expect(isPublic('/some-random-path')).toBe(false)
    })

    it('treats exactly "/api/health" + sub-paths as public (prefix match)', () => {
      expect(isPublic('/api/health')).toBe(true)
      expect(isPublic('/api/health/db')).toBe(true)  // would be a future sub-route
    })
  })
})

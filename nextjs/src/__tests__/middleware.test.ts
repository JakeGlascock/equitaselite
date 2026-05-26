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
      '/forgot-password',
      '/pricing',
      '/request-access',
      '/unsubscribe',
      '/privacy',
      '/terms',
      '/preview-denied',
      '/deck-denied',
      '/try',
      // SEO metadata routes (Next 15 generates these via src/app/robots.ts
      // and src/app/sitemap.ts). Must be reachable without auth or
      // search engines + Lighthouse get a 307 to /signin.
      '/robots.txt',
      '/sitemap.xml',
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
      // self-hosted Material Symbols subset — preload runs before any
      // user has a session, so a 307 to /signin here makes the entire
      // icon font silently fall back to ligature-text on first load.
      '/fonts/material-symbols-outlined.woff2',
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
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/passkey/signin',  // The WebAuthn ceremony IS the auth — no JWT yet.
      '/api/health',
      '/api/request-access',
      '/api/unsubscribe',
      '/api/preview/clear',
      '/api/feedback/report',
      '/api/demo/signup',
    ])('treats %s as public', (path) => {
      expect(isPublic(path)).toBe(true)
    })
  })

  describe('passkey management routes are NOT public', () => {
    // These all require an authenticated user (the middleware sets
    // x-user-id from the JWT). When previously listed under the
    // `/api/auth/` prefix in PUBLIC_API, the route handlers returned
    // a bare 401 instead of letting the middleware do auto-refresh +
    // redirect to /signin like the rest of the authed API surface.
    it.each([
      '/api/auth/passkey/register/start',
      '/api/auth/passkey/register/complete',
      '/api/auth/passkey/list',
      '/api/auth/passkey/abc-123',
    ])('treats %s as auth-required', (path) => {
      expect(isPublic(path)).toBe(false)
    })
  })

  describe('Apple App Site Association (Phase M3)', () => {
    it('treats /.well-known/apple-app-site-association as public', () => {
      // iOS fetches this on install without any session — if it ever
      // redirects to /signin, Universal Links silently break.
      expect(isPublic('/.well-known/apple-app-site-association')).toBe(true)
    })
  })

  describe('demo magic-link entry + interstitials', () => {
    it.each([
      '/try',
      '/try/check-email',
      '/try/expired',
      '/try/start/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ])('treats %s as public (signup + magic-link round-trip)', (path) => {
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

  describe('deck-token entry paths', () => {
    it.each([
      '/deck/abc123',
      '/deck/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ])('treats %s as public (token gate runs in the route handler)', (path) => {
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
      // Sovereign deal flow — every surface is auth-gated. /deals is
      // Sovereign-only and the API mirrors that. A leak here surfaces
      // private opportunities to anyone hitting the route.
      '/deals',
      '/api/deals',
      '/api/deals/abc-123/respond',
      '/api/admin/deals',
      '/api/admin/deals/abc-123',
      '/api/admin/deals/abc-123/invitations',
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

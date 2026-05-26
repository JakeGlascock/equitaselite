import type { MetadataRoute } from 'next'

// Next 15 metadata file. Renders /robots.txt as the route handler so
// search engines + Lighthouse can fetch it without going through the
// middleware auth redirect. Marketing surfaces are open; the entire
// authed product (everything under /api/, /dashboard, /profile, etc.)
// is disallowed so bots don't hit the JWT redirect path.
//
// Note: middleware still has the final say on access. This file is
// what /robots.txt SERVES — it does not change auth behavior.

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://equitaselite.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/'],
      disallow: [
        '/api/',
        '/dashboard',
        '/onboarding',
        '/profile',
        '/admin',
        '/concierge',
        '/discovery',
        '/portfolio',
        '/network',
        '/reports',
        '/insights',
        '/events',
        '/connections',
        '/match/',
        '/deals',
        '/briefings/',
        '/help',
        // Demo + preview surfaces are token-gated and shouldn't be
        // indexed — sometimes a stale token URL leaks into a Google
        // search refer log.
        '/preview/',
        '/deck/',
        '/try/',
      ],
    }],
    sitemap: `${BASE}/sitemap.xml`,
  }
}

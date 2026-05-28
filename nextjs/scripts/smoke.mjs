#!/usr/bin/env node
// Smoke checks for production paths a real customer hits.
// Run locally:   node nextjs/scripts/smoke.mjs https://equitaselite.com
// Run in CI:     SMOKE_URL=https://equitaselite.com node nextjs/scripts/smoke.mjs

const BASE = (process.env.SMOKE_URL ?? process.argv[2] ?? 'https://equitaselite.com').replace(/\/$/, '')
const TIMEOUT_MS = 15_000

// Each check asserts: GET the path, expect `status`, and the response body
// must contain `contains`. Authenticated paths (dashboard, admin, etc.) are
// exercised only at the redirect-to-/signin boundary — Cognito MFA can't be
// completed from CI without a no-MFA test account.
//
// Field reference:
//   status:           one number or array of acceptable status codes
//   contains:         substring required in response body
//   notContains:      substring that must NOT appear in response body
//   bodyAssert:       (body) => { ok: boolean, reason?: string } for custom invariants
//   redirectContains: substring required in Location header (with followRedirect: false)
//   followRedirect:   set to false to inspect a 3xx without following it
//
// Add new checks here when a route ships, NOT in a follow-up PR — a route
// without a smoke entry will silently regress. Security-shaped behaviors
// (preview scoping, auth gates, mutation blocks) MUST have a smoke entry —
// regressions on these surfaces leak real data or open mutation paths.
const PREVIEW_COOKIE = 'ee_preview=demo_angel_sarah_chen'
const PREVIEW_MUTATION_HEADERS = { 'Content-Type': 'application/json', 'Cookie': PREVIEW_COOKIE }

const CHECKS = [
  // ───── Health + public pages ─────
  { name: 'health',          path: '/api/health',      status: 200, contains: '"status":"ok"' },
  // Phase M3 — Apple App Site Association. iOS fetches this file once on
  // install to enable Universal Links. Must return 200 + JSON with no
  // redirects. Always reachable without auth.
  { name: 'aasa',            path: '/.well-known/apple-app-site-association', status: 200, contains: 'applinks' },
  // SEO metadata routes. Must return 200 (not the middleware 307 to /signin)
  // so search engines and Lighthouse can index the public marketing surface.
  { name: 'robots-txt',      path: '/robots.txt',  status: 200, contains: 'User-Agent' },
  { name: 'sitemap-xml',     path: '/sitemap.xml', status: 200, contains: '<urlset' },
  { name: 'landing',         path: '/',                status: 200, contains: 'Equitas Elite' },
  { name: 'signin',          path: '/signin',          status: 200, contains: 'Welcome back' },
  { name: 'pricing',         path: '/pricing',         status: 200, contains: 'Sovereign' },
  { name: 'request-access',  path: '/request-access',  status: 200, contains: 'Join the waitlist' },
  { name: 'terms',           path: '/terms',           status: 200, contains: 'Terms of Service' },
  { name: 'privacy',         path: '/privacy',         status: 200, contains: 'Privacy' },
  { name: 'forgot-password', path: '/forgot-password', status: 200, contains: 'Reset your password' },
  // /unsubscribe with no token still renders (shows "missing or malformed").
  // /unsubscribe with a real token would actually disable that user's mail — never run that in smoke.
  { name: 'unsubscribe-page',path: '/unsubscribe',     status: 200, contains: 'malformed' },

  // ───── Auth gates ─────
  // Every authenticated surface must redirect to /signin for an unauthenticated
  // request. If the middleware's auth gate ever breaks, all of these flip
  // simultaneously and the failure is obvious. New (app) routes go here.
  { name: 'gate-dashboard',    path: '/dashboard',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-admin',        path: '/admin',              status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-admin-access', path: '/admin/access-requests', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-admin-analytics', path: '/admin/analytics',    status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-match',        path: '/match/anything',     status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-profile',      path: '/profile',            status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-onboarding',   path: '/onboarding',         status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-events',       path: '/events',             status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-insights',     path: '/insights',           status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-network',      path: '/network',            status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-reports',      path: '/reports',            status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // Sovereign-only deal flow. Unauth must redirect; the tier gate runs
  // post-auth so we can't exercise it from CI without a Sovereign session.
  { name: 'gate-deals',        path: '/deals',              status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-deals-list',   path: '/api/deals',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-deals-respond', path: '/api/deals/x/respond', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P4 co-invest rooms — every messages route must auth-gate.
  { name: 'gate-deals-room',          path: '/deals/00000000-0000-0000-0000-000000000000',         status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-deals-messages-list', path: '/api/deals/x/messages',                              status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-deals-messages-post', path: '/api/deals/x/messages', method: 'POST', body: '',    status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-deals-msg-moderate',  path: '/api/deals/x/messages/y', method: 'PATCH', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // Admin write surface — both base + per-id + invitations subroute must
  // gate. A leak here lets any visitor read or seed deal records.
  { name: 'gate-admin-deals',         path: '/api/admin/deals',                                       status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-admin-deals-create',  path: '/api/admin/deals',                method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-admin-deals-invite',  path: '/api/admin/deals/x/invitations',  method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5 v1 — admin sets / clears a next-gen seat's parent link. Same
  // /signin redirect as the rest of /api/admin/*. A leak would let
  // any visitor reparent an existing next-gen to an arbitrary seat.
  { name: 'gate-admin-user-parent',   path: '/api/admin/users/u/parent',       method: 'PUT',  body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5b — Next-Gen shadow view. /family is auth-only; /api/me/shadow
  // must redirect unauth callers (we can't fully assert the
  // shadow-cookie mutation gate from outside a signed-in session, but
  // we can prove the route is gated like everything else under /api/).
  { name: 'gate-family-page',     path: '/family',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-shadow-enable',   path: '/api/me/shadow',   method: 'POST',   body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-shadow-disable',  path: '/api/me/shadow',   method: 'DELETE', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5c — self-serve next-gen invite. Auth-gated; without a session,
  // /signin redirect like the rest of /api/me/*. A leak here would let
  // any visitor create Cognito users + EE profiles.
  { name: 'gate-next-gen-invite', path: '/api/me/next-gen-invite', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5d — parent-owned resend. Same gate; a leak would let any
  // visitor trigger fresh Cognito temp-password emails to arbitrary
  // next-gen seats.
  { name: 'gate-next-gen-resend', path: '/api/me/next-gen-invite/resend', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5e — next-gen shadow-write routes. These two paths are on the
  // shadow allowlist (SHADOW_WRITE_ALLOWLIST_PATTERNS in lib/shadow.ts)
  // so a shadowing next-gen can comment + RSVP. The allowlist must
  // NOT make them public — proves an unauthed POST still bounces to
  // /signin like every other /api/ route. Lookalikes that lack the
  // dynamic segment are covered by the lib unit test, not here.
  { name: 'gate-next-gen-deal-comment', path: '/api/deals/00000000-0000-0000-0000-000000000000/messages', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-next-gen-event-rsvp',   path: '/api/events/00000000-0000-0000-0000-000000000000/rsvp',     method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5f — cross-account family-link request flow. The three new
  // routes must be auth-gated like every other /api/me/* — a leak
  // would let any visitor enumerate or mutate pending consent state.
  { name: 'gate-family-link-list',     path: '/api/me/family-link-requests',                                          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-family-link-accept',   path: '/api/me/family-link-requests/00000000-0000-0000-0000-000000000000/accept',  method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-family-link-decline',  path: '/api/me/family-link-requests/00000000-0000-0000-0000-000000000000/decline', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // P5g — requester-side cancel. Same gate; a leak would let any
  // visitor invalidate arbitrary pending requests.
  { name: 'gate-family-link-cancel',   path: '/api/me/family-link-requests/00000000-0000-0000-0000-000000000000/cancel',  method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-discovery',    path: '/discovery',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-portfolio',    path: '/portfolio',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-connections',  path: '/connections',        status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-concierge',    path: '/concierge',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-help',         path: '/help',               status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-briefings',    path: '/briefings/00000000-0000-0000-0000-000000000000', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },

  // Admin-only test fixture endpoint. Without a session it must redirect
  // to /signin like the rest of /admin — proves the route is wired AND
  // that it isn't accidentally on the public-API list.
  { name: 'gate-test-fixture-onboarding-start', path: '/api/admin/test-fixtures/onboarding/start', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },

  // Phase M2 — device-token endpoints. Both auth-gated; unauth callers
  // must redirect to /signin. A leak here lets anyone register an
  // arbitrary push token against any user (or revoke someone else's).
  { name: 'gate-devices-register',   path: '/api/devices/register',   method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-devices-unregister', path: '/api/devices/unregister', method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },

  // Auto-refresh path — /api/auth/refresh must stay public so the
  // middleware can hit it via internal fetch when ee_id has expired
  // but ee_refresh is still valid. A regression that protected this
  // route would break auto-refresh and force every user back through
  // MFA after one hour.
  { name: 'auth-refresh-public', path: '/api/auth/refresh', method: 'POST', body: '', status: 401, contains: 'No refresh token' },

  // Phase C — passkey management endpoints must redirect unauth
  // callers to /signin like the rest of the authed API surface
  // (they're under /api/auth/ but explicitly NOT in PUBLIC_API).
  { name: 'gate-passkey-list',           path: '/api/auth/passkey/list',            status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-passkey-register-start', path: '/api/auth/passkey/register/start',  method: 'POST', body: '', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // Passkey signin is the unauth entry point itself (the WebAuthn
  // ceremony IS the auth) — bad payload should 400, not 401.
  { name: 'passkey-signin-bad-body',     path: '/api/auth/passkey/signin', method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}', status: 400 },

  // ───── Public demo (migration 036 / Phase F) ─────
  // /try is publicly accessible — no auth required.
  { name: 'try-public', path: '/try', status: 200, contains: 'Walk through the platform' },
  // The interstitial + expired pages render with no auth too.
  { name: 'try-check-email-public', path: '/try/check-email', status: 200, contains: 'Check your email' },
  { name: 'try-expired-public',     path: '/try/expired',     status: 200, contains: 'Link not found' },
  // Magic-link route handler with a bad token redirects to /try/expired.
  // Tests the path is wired + the bad-shape pre-check fires.
  { name: 'try-start-bad-token', path: '/try/start/notatoken', status: [302, 307, 308], redirectContains: '/try/expired', followRedirect: false },
  // POST /api/demo/signup with no body → schema error 400.
  // (The endpoint is deliberately public so unauthenticated prospects
  // can hit it; the WAF auth-tier rate limit + Turnstile + magic-link
  // verify are the layered defenses, not the mutation-block.)
  { name: 'demo-signup-empty', path: '/api/demo/signup', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', status: 400 },

  // ───── Off-Market mode (migration 033) ─────
  // /pricing must list the feature under the Sovereign tier — surfacing
  // it is the only way prospects know the privacy story exists.
  { name: 'pricing-lists-off-market', path: '/pricing', status: 200, contains: 'Off-Market' },
  // PATCH /api/me without auth → redirect to /signin (proves the route
  // is wired + middleware-gated; the tier-check happens behind auth).
  { name: 'gate-me-patch-off-market', path: '/api/me', method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"is_off_market":true}', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  // Preview viewers (demo cookie) must STILL be blocked from flipping
  // off-market — same mutation gate as every other PATCH.
  {
    name: 'preview-blocks-off-market-patch',
    path: '/api/me', method: 'PATCH', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"is_off_market":true}', status: 403, contains: 'Preview mode',
  },

  // ───── Investor preview ─────
  // Malformed token → "Link not found" via the /preview-denied page.
  { name: 'preview-bad-shape', path: '/preview/notatoken',                                                          status: 200, contains: 'Link not found' },
  // Well-formed but unknown 64-char hex token follows the same denial path.
  { name: 'preview-unknown',   path: '/preview/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', status: 200, contains: 'Link not found' },
  // Direct hits to the denial page cover each branch in its reason-copy map.
  { name: 'preview-denied-default',   path: '/preview-denied',                  status: 200, contains: 'Link not found' },
  { name: 'preview-denied-revoked',   path: '/preview-denied?reason=revoked',   status: 200, contains: 'Link revoked' },
  { name: 'preview-denied-expired',   path: '/preview-denied?reason=expired',   status: 200, contains: 'Link expired' },
  { name: 'preview-denied-exhausted', path: '/preview-denied?reason=exhausted', status: 200, contains: 'View limit reached' },

  // SECURITY: preview-mode mutation block. A request carrying an
  // ee_preview cookie (gated to demo_* ids — middleware enforces the prefix
  // without a DB lookup) must NOT be allowed to POST against any authenticated
  // endpoint. If any of these flip to 2xx, a leaked preview link becomes a
  // mutation surface. Cover the high-leverage routes explicitly.
  {
    name: 'preview-blocks-walkthrough',
    path: '/api/walkthrough', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"action":"complete"}', status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-introductions',
    path: '/api/introductions', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"recipient_id":"demo_fo_hartwell"}', status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-concierge-requests',
    path: '/api/concierge/requests', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"category":"introduction","urgency":"Routine","details":"smoke test"}', status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-event-rsvp',
    path: '/api/events/00000000-0000-0000-0000-000000000000/rsvp',
    method: 'POST', headers: PREVIEW_MUTATION_HEADERS, body: '', status: 403, contains: 'Preview mode',
  },
  // Phase 6 endpoints — same mutation guard must apply.
  {
    name: 'preview-blocks-mandate-weights',
    path: '/api/me/mandate-weights', method: 'PATCH', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"scope":40,"capital":25,"timeRisk":10,"governance":5,"counterparty":10,"values":10}',
    status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-mandate-pillars',
    path: '/api/me/mandate-pillars', method: 'PATCH', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"anti_sectors":["Defense"]}',
    status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-onboarding',
    path: '/api/onboarding', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"email":"demo@x.com","role":"angel","full_name":"X","firm_name":"Y","sectors":["X"],"stages":["Seed"],"geography":["US"],"check_size_min":1,"check_size_max":2,"risk_tolerance":"Moderate"}',
    status: 403, contains: 'Preview mode',
  },
  // Phase 7B concierge annotations — preview-mode mutation block must
  // apply to the new write surfaces too. A demo profile is never a
  // concierge anyway, so the route-level check would also fail, but
  // we exercise the middleware gate explicitly.
  {
    name: 'preview-blocks-concierge-annotation-create',
    path: '/api/concierge/annotations', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"counterparty_id":"demo_fo_hartwell","note":"smoke"}',
    status: 403, contains: 'Preview mode',
  },
  {
    name: 'preview-blocks-concierge-annotation-delete',
    path: '/api/concierge/annotations/00000000-0000-0000-0000-000000000000',
    method: 'DELETE', headers: PREVIEW_MUTATION_HEADERS,
    status: 403, contains: 'Preview mode',
  },
  // Phase M2 — preview-mode demo sessions must not be able to register
  // a push token. The register handler explicitly returns 403 on the
  // preview-mode header so a leaked demo link can't quietly attach a
  // device to the demo profile.
  {
    name: 'preview-blocks-device-register',
    path: '/api/devices/register', method: 'POST', headers: PREVIEW_MUTATION_HEADERS,
    body: '{"platform":"ios","token":"abcdef0123456789abcdef0123456789"}',
    status: 403, contains: 'Preview mode',
  },

  // The /dashboard matching explainer button is visible in the preview
  // walkthrough — verify the methodology copy renders so a regression in
  // the explainer (e.g. accidentally removed from the layout) shows up here.
  {
    name: 'preview-dashboard-explainer',
    path: '/dashboard', headers: { Cookie: PREVIEW_COOKIE }, status: 200,
    contains: 'How matching works',
  },

  // SECURITY: demo-only data scoping on the investor walkthrough.
  // A demo preview cookie must not surface ANY real-member data. The
  // dashboard's match list is the highest-leverage surface — every link
  // in the rendered HTML should point at a demo_* profile. A regression
  // here re-leaks the real member directory to anyone with a preview link.
  {
    name: 'preview-dashboard-demo-only',
    path: '/dashboard', headers: { Cookie: PREVIEW_COOKIE }, status: 200,
    bodyAssert(body) {
      const matchLinks = [...body.matchAll(/href="\/match\/([^"]+)"/g)].map(m => m[1])
      if (matchLinks.length === 0) {
        return { ok: false, reason: 'no /match links found — dashboard render may have changed' }
      }
      const leaked = matchLinks.filter(id => !id.startsWith('demo_'))
      if (leaked.length > 0) {
        return { ok: false, reason: `non-demo ids leaked: ${leaked.slice(0, 3).join(', ')}` }
      }
      return { ok: true }
    },
  },
  // Same scope guard, page-level: a demo viewer trying to open a non-demo
  // match-detail id must hit notFound() (404) — either because the id
  // doesn't exist or because the scope check rejects it. Either outcome
  // proves the data doesn't surface.
  {
    name: 'preview-match-non-demo-404',
    path: '/match/some-real-user-id',
    headers: { Cookie: PREVIEW_COOKIE },
    status: 404,
  },

  // The exit-preview endpoint stays public + reachable. A regression here
  // would prevent investors from cleanly exiting their session.
  { name: 'preview-clear', path: '/api/preview/clear', method: 'POST', status: 200, contains: '"ok":true' },

  // ───── Pitch deck (token-gated HTML) ─────
  // Same shape as preview entry: malformed tokens redirect to /deck-denied,
  // which we follow and assert on the resulting page.
  { name: 'deck-bad-shape', path: '/deck/notatoken',                                                          status: 200, contains: 'Deck link not found' },
  { name: 'deck-unknown',   path: '/deck/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', status: 200, contains: 'Deck link not found' },
  // Direct hits to the denial page cover each branch in its reason-copy map.
  { name: 'deck-denied-default',   path: '/deck-denied',                  status: 200, contains: 'Deck link not found' },
  { name: 'deck-denied-revoked',   path: '/deck-denied?reason=revoked',   status: 200, contains: 'Deck link revoked' },
  { name: 'deck-denied-expired',   path: '/deck-denied?reason=expired',   status: 200, contains: 'Deck link expired' },
  { name: 'deck-denied-exhausted', path: '/deck-denied?reason=exhausted', status: 200, contains: 'View limit reached' },

  // ───── Static assets that MUST be public ─────
  // Self-hosted Material Symbols subset — preload runs before any user
  // has a session, so a 307 to /signin here makes the icon font silently
  // fail to load for fresh users and every icon falls back to ligature-
  // text ("lock", "settings", etc.). Status 200 + woff2 magic bytes in
  // the body prove the file is actually served (not redirected).
  {
    name: 'fonts-material-symbols-public',
    path: '/fonts/material-symbols-outlined.woff2',
    status: 200,
    bodyAssert(body) {
      // woff2 magic = 0x77 0x4f 0x46 0x32 = ASCII "wOF2".
      const ok = body.charCodeAt(0) === 0x77 && body.charCodeAt(1) === 0x4f
              && body.charCodeAt(2) === 0x46 && body.charCodeAt(3) === 0x32
      return ok ? { ok: true } : { ok: false, reason: `body did not start with wOF2 magic` }
    },
  },

  // ───── Error feedback ─────
  // User-report endpoint must be reachable (not blocked by middleware)
  // and must validate input. Empty body → 400. We deliberately do NOT
  // smoke a successful POST: that would create a real user_reports row
  // and email the staff inbox on every deploy.
  {
    name:     'feedback-validates',
    path:     '/api/feedback/report',
    method:   'POST',
    headers:  { 'Content-Type': 'application/json' },
    body:     '{}',
    status:   400,
  },
]

async function fetchWithTimeout(url, opts) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

function checkStatus(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected
}

console.log(`Smoke target: ${BASE}\n`)

const results = []
for (const c of CHECKS) {
  const url   = `${BASE}${c.path}`
  const start = Date.now()
  try {
    const res = await fetchWithTimeout(url, {
      method:   c.method ?? 'GET',
      redirect: c.followRedirect === false ? 'manual' : 'follow',
      headers:  { 'User-Agent': 'equitaselite-smoke/1.0', ...(c.headers ?? {}) },
      body:     c.body,
    })
    const ms = Date.now() - start
    const statusOk = checkStatus(res.status, c.status)

    let bodyOk = true
    let reason = ''
    // Read body once if any body-level assertion is configured — avoids
    // double-reads (the response stream can only be consumed once).
    const needsBody = !!(c.contains || c.notContains || c.bodyAssert)
    const body = needsBody ? await res.text() : ''
    if (c.contains && !body.includes(c.contains)) {
      bodyOk = false
      reason = ` body missing "${c.contains}"`
    }
    if (bodyOk && c.notContains && body.includes(c.notContains)) {
      bodyOk = false
      reason = ` body unexpectedly contained "${c.notContains}"`
    }
    if (bodyOk && c.bodyAssert) {
      const assertion = c.bodyAssert(body)
      if (!assertion.ok) {
        bodyOk = false
        reason = ` ${assertion.reason ?? 'bodyAssert returned false'}`
      }
    }
    if (c.redirectContains) {
      const loc = res.headers.get('location') ?? ''
      bodyOk = loc.includes(c.redirectContains)
      if (!bodyOk) reason = ` location="${loc}" missing "${c.redirectContains}"`
    }

    if (statusOk && bodyOk) {
      console.log(`✓ ${c.name.padEnd(16)} ${String(res.status).padEnd(4)} ${ms}ms  ${url}`)
      results.push({ ok: true, name: c.name })
    } else {
      console.log(`✗ ${c.name.padEnd(16)} ${String(res.status).padEnd(4)} ${ms}ms  ${url}${reason}`)
      results.push({ ok: false, name: c.name, status: res.status, reason })
    }
  } catch (err) {
    const ms = Date.now() - start
    console.log(`✗ ${c.name.padEnd(16)} ERR  ${ms}ms  ${url}  ${err.message}`)
    results.push({ ok: false, name: c.name, error: err.message })
  }
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.error(`Failed: ${failed.map(f => f.name).join(', ')}`)
  process.exit(1)
}

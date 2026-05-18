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
  { name: 'landing',         path: '/',                status: 200, contains: 'Equitas Elite' },
  { name: 'signin',          path: '/signin',          status: 200, contains: 'Welcome back' },
  { name: 'pricing',         path: '/pricing',         status: 200, contains: 'Sovereign' },
  { name: 'request-access',  path: '/request-access',  status: 200, contains: 'Request access' },
  { name: 'privacy',         path: '/privacy',         status: 200, contains: 'Privacy' },
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
  { name: 'gate-discovery',    path: '/discovery',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-portfolio',    path: '/portfolio',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-connections',  path: '/connections',        status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-concierge',    path: '/concierge',          status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-help',         path: '/help',               status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
  { name: 'gate-briefings',    path: '/briefings/00000000-0000-0000-0000-000000000000', status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },

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

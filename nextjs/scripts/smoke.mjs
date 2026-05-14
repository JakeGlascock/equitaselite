#!/usr/bin/env node
// Smoke checks for production paths a real customer hits.
// Run locally:   node nextjs/scripts/smoke.mjs https://equitaselite.com
// Run in CI:     SMOKE_URL=https://equitaselite.com node nextjs/scripts/smoke.mjs

const BASE = (process.env.SMOKE_URL ?? process.argv[2] ?? 'https://equitaselite.com').replace(/\/$/, '')
const TIMEOUT_MS = 15_000

// Each check asserts: GET the path, expect `status`, and the response body
// must contain `contains`. Authenticated paths (dashboard, admin, etc.) are
// intentionally excluded — Cognito MFA can't be completed from CI without
// extra plumbing. Add those once we have a no-MFA test account.
const CHECKS = [
  { name: 'health',         path: '/api/health',     status: 200, contains: '"status":"ok"' },
  { name: 'landing',        path: '/',               status: 200, contains: 'Equitas Elite' },
  { name: 'signin',         path: '/signin',         status: 200, contains: 'Welcome back' },
  { name: 'pricing',        path: '/pricing',        status: 200, contains: 'Sovereign' },
  { name: 'request-access', path: '/request-access', status: 200, contains: 'Request access' },
  // Auth gate: unauthenticated /dashboard must redirect (not 200, not 500).
  { name: 'auth-gate',      path: '/dashboard',      status: [302, 307, 308], redirectContains: '/signin', followRedirect: false },
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
      redirect: c.followRedirect === false ? 'manual' : 'follow',
      headers:  { 'User-Agent': 'equitaselite-smoke/1.0' },
    })
    const ms = Date.now() - start
    const statusOk = checkStatus(res.status, c.status)

    let bodyOk = true
    let reason = ''
    if (c.contains) {
      const body = await res.text()
      bodyOk = body.includes(c.contains)
      if (!bodyOk) reason = ` body missing "${c.contains}"`
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

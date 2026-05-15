import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { publicUrl } from '@/lib/public-url'

// publicUrl only reads headers, so we can fake a NextRequest with just
// a headers.get() method. The cast lets us avoid pulling in the full
// next/server runtime in a Node-only test.
function req(headers: Record<string, string>): NextRequest {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

describe('publicUrl', () => {
  it('prefers x-forwarded-host + x-forwarded-proto (ALB case)', () => {
    const url = publicUrl(req({
      'x-forwarded-host':  'equitaselite.com',
      'x-forwarded-proto': 'https',
      'host':              'ip-10-0-1-2.ec2.internal:3000',
    }), '/dashboard')
    expect(url.toString()).toBe('https://equitaselite.com/dashboard')
  })

  it('falls back to host header when x-forwarded-host is absent', () => {
    const url = publicUrl(req({
      'host': 'localhost:3000',
    }), '/signin')
    expect(url.toString()).toBe('https://localhost:3000/signin')
  })

  it('falls back to equitaselite.com when no host headers at all', () => {
    const url = publicUrl(req({}), '/')
    expect(url.toString()).toBe('https://equitaselite.com/')
  })

  it('preserves query strings in the path', () => {
    const url = publicUrl(req({ 'x-forwarded-host': 'equitaselite.com' }), '/preview-denied?reason=expired')
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.pathname).toBe('/preview-denied')
  })

  it('defaults proto to https when only forwarded host is present', () => {
    const url = publicUrl(req({ 'x-forwarded-host': 'equitaselite.com' }), '/x')
    expect(url.protocol).toBe('https:')
  })

  it('respects http when x-forwarded-proto says http (local dev with reverse proxy)', () => {
    const url = publicUrl(req({
      'x-forwarded-host':  'localhost:8080',
      'x-forwarded-proto': 'http',
    }), '/x')
    expect(url.toString()).toBe('http://localhost:8080/x')
  })
})

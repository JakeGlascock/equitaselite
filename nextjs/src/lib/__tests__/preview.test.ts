import { describe, it, expect } from 'vitest'
import { validateTokenRow, isDemoProfileId, generateToken } from '@/lib/preview'

const NOW = new Date('2026-05-15T10:00:00Z')

function row(overrides: Partial<Parameters<typeof validateTokenRow>[0] & object> = {}) {
  return {
    demo_profile_id: 'demo_angel_sarah_chen',
    expires_at:      new Date('2026-05-29T10:00:00Z'),  // 14d ahead
    max_views:       25,
    view_count:      0,
    revoked_at:      null,
    ...overrides,
  }
}

describe('validateTokenRow', () => {
  it('accepts a fresh, unused, unexpired, non-revoked token', () => {
    const res = validateTokenRow(row(), NOW)
    expect(res.ok).toBe(true)
    expect(res.demoProfileId).toBe('demo_angel_sarah_chen')
  })

  it('rejects null row as not_found', () => {
    expect(validateTokenRow(null, NOW)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('rejects revoked token even if otherwise valid', () => {
    const res = validateTokenRow(row({ revoked_at: new Date('2026-05-14T00:00:00Z') }), NOW)
    expect(res).toEqual({ ok: false, reason: 'revoked' })
  })

  it('rejects expired token (expires_at === now is expired)', () => {
    const res = validateTokenRow(row({ expires_at: NOW }), NOW)
    expect(res).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects expired token (expires_at in the past)', () => {
    const res = validateTokenRow(row({ expires_at: new Date('2026-05-01T10:00:00Z') }), NOW)
    expect(res).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects exhausted token (view_count >= max_views)', () => {
    expect(validateTokenRow(row({ view_count: 25, max_views: 25 }), NOW)).toEqual({ ok: false, reason: 'exhausted' })
    expect(validateTokenRow(row({ view_count: 26, max_views: 25 }), NOW)).toEqual({ ok: false, reason: 'exhausted' })
  })

  it('accepts a token at exactly view_count = max_views - 1', () => {
    expect(validateTokenRow(row({ view_count: 24, max_views: 25 }), NOW).ok).toBe(true)
  })

  it('handles ISO-string expires_at (pg may return either form)', () => {
    const res = validateTokenRow(row({ expires_at: '2026-05-29T10:00:00Z' }), NOW)
    expect(res.ok).toBe(true)
  })

  it('prioritizes revoked over expired (revoked overrides everything)', () => {
    const res = validateTokenRow(
      row({ revoked_at: new Date(), expires_at: new Date('2026-05-01T00:00:00Z') }),
      NOW,
    )
    expect(res.reason).toBe('revoked')
  })
})

describe('isDemoProfileId', () => {
  it('accepts demo_* ids', () => {
    expect(isDemoProfileId('demo_angel_sarah_chen')).toBe(true)
    expect(isDemoProfileId('demo_fo_hartwell')).toBe(true)
  })

  it('rejects real-user ids, managed ids, empty, undefined', () => {
    expect(isDemoProfileId('user_abc')).toBe(false)
    expect(isDemoProfileId('managed_xyz')).toBe(false)
    expect(isDemoProfileId('')).toBe(false)
    expect(isDemoProfileId(undefined)).toBe(false)
    expect(isDemoProfileId(null)).toBe(false)
  })

  it('rejects implausibly long ids (defense against tampered cookies)', () => {
    expect(isDemoProfileId('demo_' + 'x'.repeat(200))).toBe(false)
  })
})

describe('generateToken', () => {
  it('returns a 64-char hex string (32 bytes)', () => {
    const t = generateToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns a different token each call', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
  })
})

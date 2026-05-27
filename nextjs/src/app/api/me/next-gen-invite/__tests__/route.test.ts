import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne   = vi.fn()
const mockQuery      = vi.fn()
const mockInviteUser = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  query:    (...a: unknown[]) => mockQuery(...a),
}))
vi.mock('@/lib/auth', () => ({
  inviteUser: (...a: unknown[]) => mockInviteUser(...a),
}))

import { POST } from '../route'

const CALLER = 'parent-1'
const NG_SUB = 'next-gen-sub-1'
const EMAIL  = 'family.member@example.com'

function buildReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CALLER
  return new NextRequest('http://localhost/api/me/next-gen-invite', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })
}

const wealthHolder = { is_family_office: true, is_family_foundation: false, is_daf: false }
const plainAngel   = { is_family_office: false, is_family_foundation: false, is_daf: false }

beforeEach(() => {
  mockQueryOne.mockReset(); mockQuery.mockReset(); mockInviteUser.mockReset()
  mockQuery.mockResolvedValue(undefined)
})

describe('POST /api/me/next-gen-invite — auth + role gate', () => {
  it('401s when no x-user-id header is present', async () => {
    const res = await POST(buildReq({ email: EMAIL }, { userId: null }))
    expect(res.status).toBe(401)
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const res = await POST(buildReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller profile is missing entirely', async () => {
    mockQueryOne.mockResolvedValueOnce(null)   // caller lookup
    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(404)
  })

  it('403s when the caller is not a wealth-holder (FO / Foundation / DAF)', async () => {
    mockQueryOne.mockResolvedValueOnce(plainAngel)
    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/Family Office, Family Foundation/i)
    expect(mockInviteUser).not.toHaveBeenCalled()
  })
})

describe('POST /api/me/next-gen-invite — collision guards', () => {
  it('409s when a profile with that email already exists (cross-account is P5d+)', async () => {
    mockQueryOne
      .mockResolvedValueOnce(wealthHolder)
      .mockResolvedValueOnce({ id: 'existing-1' })   // collision
    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already on EE/i)
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('409s when Cognito reports a UsernameExistsException', async () => {
    mockQueryOne
      .mockResolvedValueOnce(wealthHolder)
      .mockResolvedValueOnce(null)
    mockInviteUser.mockRejectedValueOnce(new Error('UsernameExistsException: User already exists'))
    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/identity provider/i)
  })

  it('500s on an unexpected Cognito failure', async () => {
    mockQueryOne
      .mockResolvedValueOnce(wealthHolder)
      .mockResolvedValueOnce(null)
    mockInviteUser.mockRejectedValueOnce(new Error('network timeout'))
    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/me/next-gen-invite — happy path', () => {
  it('seeds the placeholder with is_next_gen=TRUE + parent_profile_id=caller', async () => {
    mockQueryOne
      .mockResolvedValueOnce(wealthHolder)
      .mockResolvedValueOnce(null)
    mockInviteUser.mockResolvedValueOnce({ sub: NG_SUB })

    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(201)
    expect(mockInviteUser).toHaveBeenCalledWith(EMAIL)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('INSERT INTO profiles')
    expect(sql).toContain('is_next_gen, parent_profile_id')
    expect(params[0]).toBe(NG_SUB)               // id
    expect(params[1]).toBe(EMAIL)                // email
    expect(params[3]).toBe(CALLER)               // parent_profile_id
    // full_name derived from email local-part — exact format covered
    // by admin/invite tests, just spot-check that it's non-empty.
    expect(typeof params[2]).toBe('string')
    expect((params[2] as string).length).toBeGreaterThan(0)
  })

  it('falls back to minimal seed on pre-043 environment (no parent_profile_id col)', async () => {
    mockQueryOne
      .mockResolvedValueOnce(wealthHolder)
      .mockResolvedValueOnce(null)
    mockInviteUser.mockResolvedValueOnce({ sub: NG_SUB })
    // First INSERT (with is_next_gen + parent_profile_id) rejects;
    // fallback INSERT (legacy columns only) accepts.
    mockQuery
      .mockRejectedValueOnce(new Error('column "parent_profile_id" does not exist'))
      .mockResolvedValueOnce(undefined)

    const res = await POST(buildReq({ email: EMAIL }))
    expect(res.status).toBe(201)
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const fallbackSql = mockQuery.mock.calls[1][0] as string
    expect(fallbackSql).not.toContain('is_next_gen')
    expect(fallbackSql).not.toContain('parent_profile_id')
  })
})

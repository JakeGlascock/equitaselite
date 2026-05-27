import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne     = vi.fn()
const mockResendInvite = vi.fn()

vi.mock('@/lib/db',   () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/auth', () => ({ resendInvite: (...a: unknown[]) => mockResendInvite(...a) }))

import { POST } from '../route'

const PARENT_ID = 'parent-1'
const NG_ID     = 'next-gen-1'
const NG_EMAIL  = 'next-gen@example.com'

function buildReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? PARENT_ID
  return new NextRequest(
    'http://localhost/api/me/next-gen-invite/resend',
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
}

beforeEach(() => {
  mockQueryOne.mockReset()
  mockResendInvite.mockReset()
})

describe('POST /api/me/next-gen-invite/resend — auth + ownership', () => {
  it('401s when no x-user-id header', async () => {
    const res = await POST(buildReq({ next_gen_id: NG_ID }, { userId: null }))
    expect(res.status).toBe(401)
    expect(mockResendInvite).not.toHaveBeenCalled()
  })

  it('400s on missing next_gen_id', async () => {
    const res = await POST(buildReq({}))
    expect(res.status).toBe(400)
  })

  it('404s when the caller does not parent the target (no parent_profile_id match)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(buildReq({ next_gen_id: NG_ID }))
    expect(res.status).toBe(404)
    // Verify the gate is the parent-link itself, not a follow-up check.
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('WHERE id = $1 AND parent_profile_id = $2')
    expect(params).toEqual([NG_ID, PARENT_ID])
    expect(mockResendInvite).not.toHaveBeenCalled()
  })
})

describe('POST /api/me/next-gen-invite/resend — onboarding-status branch', () => {
  it('400s when the target has already onboarded — they use forgot-password', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, email: NG_EMAIL, onboarding_completed: true,
    })
    const res = await POST(buildReq({ next_gen_id: NG_ID }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/forgot-password/i)
    expect(mockResendInvite).not.toHaveBeenCalled()
  })

  it('calls Cognito resendInvite with the target email on the happy path', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, email: NG_EMAIL, onboarding_completed: false,
    })
    mockResendInvite.mockResolvedValueOnce(undefined)
    const res = await POST(buildReq({ next_gen_id: NG_ID }))
    expect(res.status).toBe(200)
    expect(mockResendInvite).toHaveBeenCalledWith(NG_EMAIL)
    expect(await res.json()).toEqual({ ok: true, email: NG_EMAIL })
  })

  it('500s on Cognito failure (surfaces the error)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, email: NG_EMAIL, onboarding_completed: false,
    })
    mockResendInvite.mockRejectedValueOnce(new Error('network'))
    const res = await POST(buildReq({ next_gen_id: NG_ID }))
    expect(res.status).toBe(500)
  })
})

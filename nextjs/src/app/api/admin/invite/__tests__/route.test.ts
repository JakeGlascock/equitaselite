import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockInviteUser  = vi.fn()
const mockIsUserAdmin = vi.fn()
const mockQuery       = vi.fn()

vi.mock('@/lib/auth',  () => ({ inviteUser: (...a: unknown[]) => mockInviteUser(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/db',    () => ({ query: (...a: unknown[]) => mockQuery(...a) }))

import { POST } from '../route'

function postReq(body: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/invite', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockInviteUser.mockReset(); mockIsUserAdmin.mockReset(); mockQuery.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/invite', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(postReq({ email: 'a@b.com' }))).status).toBe(403)
  })

  it('rejects invalid email', async () => {
    expect((await POST(postReq({ email: 'not-email' }))).status).toBe(400)
  })

  it('500s when Cognito invite fails', async () => {
    mockInviteUser.mockRejectedValueOnce(new Error('Cognito down'))
    expect((await POST(postReq({ email: 'a@b.com' }))).status).toBe(500)
  })

  it('returns 201 with sub + placeholderCreated=true on full success', async () => {
    mockInviteUser.mockResolvedValueOnce({ sub: 'cognito-sub-1' })
    mockQuery.mockResolvedValueOnce(undefined)

    const res = await POST(postReq({ email: 'alice.chen@example.com' }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.placeholderCreated).toBe(true)
    expect(body.sub).toBe('cognito-sub-1')
    // Placeholder INSERT received the derived full_name
    const [, args] = mockQuery.mock.calls[0]
    expect(args[2]).toBe('Alice Chen')
  })

  it('returns 201 with placeholderCreated=false if placeholder INSERT fails (soft)', async () => {
    mockInviteUser.mockResolvedValueOnce({ sub: 'cognito-sub-1' })
    mockQuery.mockRejectedValueOnce(new Error('UNIQUE violation'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq({ email: 'a@b.com' }))

    expect(res.status).toBe(201)
    expect((await res.json()).placeholderCreated).toBe(false)
    errSpy.mockRestore()
  })
})

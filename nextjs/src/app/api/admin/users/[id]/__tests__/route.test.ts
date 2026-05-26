import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne          = vi.fn()
const mockIsUserAdmin       = vi.fn()
const mockDeleteCognitoUser = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/admin', () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}))
vi.mock('@/lib/auth', () => ({
  deleteCognitoUser: (...a: unknown[]) => mockDeleteCognitoUser(...a),
}))

import { PATCH, DELETE } from '../route'

const ADMIN_ID  = 'admin-1'
const ADMIN_EM  = 'admin@x.com'
const TARGET_ID = 'target-1'

function buildReq(
  method: 'PATCH' | 'DELETE',
  body?: unknown,
  opts: { admin?: boolean; url?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.admin !== false) {
    headers['x-user-id']    = ADMIN_ID
    headers['x-user-email'] = ADMIN_EM
  }
  return new NextRequest(opts.url ?? `http://localhost/api/admin/users/${TARGET_ID}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const paramsFor = (id: string) => () => Promise.resolve({ id })

beforeEach(() => {
  mockQueryOne.mockReset(); mockIsUserAdmin.mockReset(); mockDeleteCognitoUser.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/users/[id] — guard rails', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await PATCH(buildReq('PATCH', { is_admin: true }), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(403)
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('rejects an empty payload (no fields to update)', async () => {
    const res = await PATCH(buildReq('PATCH', {}), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown membership value', async () => {
    const res = await PATCH(buildReq('PATCH', { membership: 'platinum' }), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(400)
  })

  it('blocks an admin from revoking their own admin (lockout defense)', async () => {
    const res = await PATCH(
      buildReq('PATCH', { is_admin: false }),
      { params: paramsFor(ADMIN_ID)() },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/cannot revoke your own admin/i)
  })

  it('blocks assigning a user as their own relationship manager', async () => {
    const res = await PATCH(
      buildReq('PATCH', { relationship_manager_id: TARGET_ID }),
      { params: paramsFor(TARGET_ID)() },
    )
    expect(res.status).toBe(400)
  })

  it('blocks assigning a non-concierge as relationship manager', async () => {
    mockQueryOne.mockResolvedValueOnce(null)   // RM not a concierge
    const res = await PATCH(
      buildReq('PATCH', { relationship_manager_id: 'rm-1' }),
      { params: paramsFor(TARGET_ID)() },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/must be a concierge/i)
  })
})

describe('PATCH /api/admin/users/[id] — successful updates', () => {
  it('updates flags and returns the new row', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: TARGET_ID, is_admin: false, is_concierge: true,
      is_angel: false, is_family_office: false,
      is_next_gen: false, is_family_foundation: false, is_daf: false,
      membership: 'select', relationship_manager_id: null,
    })

    const res = await PATCH(
      buildReq('PATCH', { is_concierge: true, membership: 'select' }),
      { params: paramsFor(TARGET_ID)() },
    )

    expect(res.status).toBe(200)
    expect((await res.json()).is_concierge).toBe(true)
  })

  it('clears the RM when explicit null is sent', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: TARGET_ID, is_admin: false, is_concierge: false,
      is_angel: false, is_family_office: false,
      is_next_gen: false, is_family_foundation: false, is_daf: false,
      membership: 'access', relationship_manager_id: null,
    })

    const res = await PATCH(
      buildReq('PATCH', { relationship_manager_id: null }),
      { params: paramsFor(TARGET_ID)() },
    )

    expect(res.status).toBe(200)
  })

  it('returns 404 when the row UPDATE matches nothing', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(
      buildReq('PATCH', { is_admin: true }),
      { params: paramsFor(TARGET_ID)() },
    )
    expect(res.status).toBe(404)
  })

  it('falls back to the pre-033 UPDATE shape when migration columns are missing', async () => {
    // Primary UPDATE throws because off_market_grace_until column doesn't
    // exist yet; route should retry the legacy UPDATE.
    mockQueryOne
      .mockRejectedValueOnce(new Error('column "off_market_grace_until" does not exist'))
      .mockResolvedValueOnce({
        id: TARGET_ID, is_admin: true, is_concierge: false,
        membership: null, relationship_manager_id: null,
      })

    const res = await PATCH(
      buildReq('PATCH', { is_admin: true }),
      { params: paramsFor(TARGET_ID)() },
    )

    expect(res.status).toBe(200)
    expect(mockQueryOne).toHaveBeenCalledTimes(2)
  })

  it('rethrows non-migration errors instead of falling back', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('connection refused'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PATCH(
      buildReq('PATCH', { is_admin: true }),
      { params: paramsFor(TARGET_ID)() },
    )

    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it.each([
    ['is_concierge', 'concierge columns'],
    ['membership',   'membership column'],
    ['relationship_manager_id', 'relationship_manager_id column'],
  ])('maps "%s" missing-column errors to a 400 with %s hint', async (col, fragment) => {
    mockQueryOne.mockRejectedValueOnce(new Error(`column "${col}" does not exist`))
    mockQueryOne.mockRejectedValueOnce(new Error(`column "${col}" does not exist`))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PATCH(
      buildReq('PATCH', { is_admin: true }),
      { params: paramsFor(TARGET_ID)() },
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error.toLowerCase()).toContain(fragment.toLowerCase())
    errSpy.mockRestore()
  })
})

describe('DELETE /api/admin/users/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(403)
  })

  it('blocks self-deletion', async () => {
    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(ADMIN_ID)() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/cannot delete your own/i)
  })

  it('blocks demo profile deletion', async () => {
    const res = await DELETE(buildReq('DELETE'), { params: paramsFor('demo_alice')() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/demo profiles/i)
  })

  it('blocks deleting an admin', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: TARGET_ID, email: 't@x.com', is_admin: true, is_concierge: false,
    })
    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/revoke admin/i)
  })

  it('blocks deleting a concierge', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: TARGET_ID, email: 't@x.com', is_admin: false, is_concierge: true,
    })
    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/revoke concierge/i)
  })

  it('deletes from Cognito + profile when both exist', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: TARGET_ID, email: 't@x.com', is_admin: false, is_concierge: false })
      .mockResolvedValueOnce({ id: TARGET_ID })   // profile DELETE result
    mockDeleteCognitoUser.mockResolvedValueOnce(undefined)

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(200)
    expect(mockDeleteCognitoUser).toHaveBeenCalledWith('t@x.com')
  })

  it('skips Cognito delete for managed accounts (DB-only rows)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'managed_x', email: '', is_admin: false, is_concierge: false })
      .mockResolvedValueOnce({ id: 'managed_x' })

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor('managed_x')() })

    expect(res.status).toBe(200)
    expect(mockDeleteCognitoUser).not.toHaveBeenCalled()
  })

  it('uses query-string email when no profile exists yet (invited-but-not-onboarded)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)            // no profile row
    mockDeleteCognitoUser.mockResolvedValueOnce(undefined)

    const req = buildReq('DELETE', undefined, {
      url: `http://localhost/api/admin/users/${TARGET_ID}?email=invited%40x.com`,
    })
    const res = await DELETE(req, { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(200)
    expect(mockDeleteCognitoUser).toHaveBeenCalledWith('invited@x.com')
  })

  it('returns 400 when no profile and no ?email is given (cannot resolve Cognito username)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Missing email/i)
  })

  it('continues if Cognito reports UserNotFound (already gone)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: TARGET_ID, email: 't@x.com', is_admin: false, is_concierge: false })
      .mockResolvedValueOnce({ id: TARGET_ID })
    mockDeleteCognitoUser.mockRejectedValueOnce(new Error('UserNotFoundException: user does not exist'))

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(200)
  })

  it('returns 500 when Cognito delete fails for any other reason', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: TARGET_ID, email: 't@x.com', is_admin: false, is_concierge: false,
    })
    mockDeleteCognitoUser.mockRejectedValueOnce(new Error('Throttling'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it('returns 500 if profile delete itself fails', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: TARGET_ID, email: 't@x.com', is_admin: false, is_concierge: false })
      .mockRejectedValueOnce(new Error('FK violation'))
    mockDeleteCognitoUser.mockResolvedValueOnce(undefined)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await DELETE(buildReq('DELETE'), { params: paramsFor(TARGET_ID)() })

    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})

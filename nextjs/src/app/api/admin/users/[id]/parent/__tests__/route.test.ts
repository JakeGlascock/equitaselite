import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin   = vi.fn()
const mockLinkNextGen   = vi.fn()
const mockUnlinkNextGen = vi.fn()

vi.mock('@/lib/admin',  () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/family', () => ({
  linkNextGen:   (...a: unknown[]) => mockLinkNextGen(...a),
  unlinkNextGen: (...a: unknown[]) => mockUnlinkNextGen(...a),
}))

import { PUT } from '../route'

const ADMIN_ID = 'admin-1'
const ADMIN_EM = 'admin@x.com'
const NG_ID    = 'next-gen-1'

function buildReq(body: unknown, opts: { admin?: boolean; id?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.admin !== false) {
    headers['x-user-id']    = ADMIN_ID
    headers['x-user-email'] = ADMIN_EM
  }
  return new NextRequest(
    `http://localhost/api/admin/users/${opts.id ?? NG_ID}/parent`,
    { method: 'PUT', headers, body: JSON.stringify(body) },
  )
}
const paramsFor = (id: string) => () => Promise.resolve({ id })

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockLinkNextGen.mockReset(); mockUnlinkNextGen.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PUT /api/admin/users/[id]/parent — auth', () => {
  it('forbids non-admins (403, no DB writes)', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false)
    const res = await PUT(buildReq({ parent_profile_id: 'p1' }), { params: paramsFor(NG_ID)() })
    expect(res.status).toBe(403)
    expect(mockLinkNextGen).not.toHaveBeenCalled()
    expect(mockUnlinkNextGen).not.toHaveBeenCalled()
  })

  it('rejects an invalid body (missing parent_profile_id key)', async () => {
    const res = await PUT(buildReq({}), { params: paramsFor(NG_ID)() })
    expect(res.status).toBe(400)
    expect(mockLinkNextGen).not.toHaveBeenCalled()
  })

  it('rejects an empty-string parent_profile_id', async () => {
    const res = await PUT(buildReq({ parent_profile_id: '' }), { params: paramsFor(NG_ID)() })
    expect(res.status).toBe(400)
    expect(mockLinkNextGen).not.toHaveBeenCalled()
  })

  it('refuses to link a demo profile', async () => {
    const res = await PUT(
      buildReq({ parent_profile_id: 'parent-1' }),
      { params: paramsFor('demo_angel_1')() },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Demo profiles cannot be linked/i)
    expect(mockLinkNextGen).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/users/[id]/parent — link/unlink semantics', () => {
  it('null clears the link via unlinkNextGen', async () => {
    mockUnlinkNextGen.mockResolvedValueOnce(undefined)
    const res = await PUT(buildReq({ parent_profile_id: null }), { params: paramsFor(NG_ID)() })
    expect(res.status).toBe(200)
    expect(mockUnlinkNextGen).toHaveBeenCalledWith(NG_ID)
    expect(mockLinkNextGen).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body).toEqual({ ok: true, parent_profile_id: null })
  })

  it('writes the link via linkNextGen(parentId, nextGenId)', async () => {
    mockLinkNextGen.mockResolvedValueOnce({ ok: true })
    const res = await PUT(
      buildReq({ parent_profile_id: 'parent-1' }),
      { params: paramsFor(NG_ID)() },
    )
    expect(res.status).toBe(200)
    expect(mockLinkNextGen).toHaveBeenCalledWith('parent-1', NG_ID)
    const body = await res.json()
    expect(body).toEqual({ ok: true, parent_profile_id: 'parent-1' })
  })

  it('surfaces lib-side validation failures as 400 with the error message', async () => {
    mockLinkNextGen.mockResolvedValueOnce({ ok: false, error: 'Target profile must have the Next-Gen role flag set.' })
    const res = await PUT(
      buildReq({ parent_profile_id: 'parent-1' }),
      { params: paramsFor('plain-fo')() },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/must have the Next-Gen role flag/i)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()
const mockQuery    = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  query:    (...a: unknown[]) => mockQuery(...a),
}))

import { POST, DELETE } from '../route'
import { SHADOW_COOKIE } from '@/lib/shadow'

const NG_ID     = 'next-gen-1'
const PARENT_ID = 'parent-1'

function buildReq(method: 'POST' | 'DELETE', opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null && opts.userId !== undefined) headers['x-user-id'] = opts.userId
  if (opts.userId === undefined) headers['x-user-id'] = NG_ID
  return new NextRequest('http://localhost/api/me/shadow', { method, headers })
}

beforeEach(() => {
  mockQueryOne.mockReset(); mockQuery.mockReset()
  mockQuery.mockResolvedValue(undefined)   // notification write default-ok
})

describe('POST /api/me/shadow — enable shadow view', () => {
  it('401s when no x-user-id header is present', async () => {
    const res = await POST(buildReq('POST', { userId: null }))
    expect(res.status).toBe(401)
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('400s when the caller is not a next-gen / has no parent linked', async () => {
    mockQueryOne.mockResolvedValueOnce(null)   // JOIN returns no row
    const res = await POST(buildReq('POST'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/only available to next-gen seats/i)
  })

  it('writes a notification on the parent\'s feed when enabling', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, parent_id: PARENT_ID, parent_name: 'P', parent_firm: 'PFirm',
    })
    await POST(buildReq('POST'))
    expect(mockQuery).toHaveBeenCalled()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain(`INSERT INTO notifications`)
    expect(sql).toContain(`'next_gen_shadow'`)
    expect(params[0]).toBe(PARENT_ID)
    expect(typeof params[1]).toBe('string')                 // JSON payload
    const payload = JSON.parse(params[1])
    expect(payload.next_gen_id).toBe(NG_ID)
    expect(typeof payload.enabled_at).toBe('string')
  })

  it('sets the ee_shadow_parent cookie to the parent id with httpOnly + maxAge', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, parent_id: PARENT_ID, parent_name: 'P', parent_firm: 'PFirm',
    })
    const res = await POST(buildReq('POST'))
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SHADOW_COOKIE}=${PARENT_ID}`)
    expect(setCookie).toMatch(/httponly/i)
    expect(setCookie).toMatch(/max-age=/i)
  })

  it('still returns 200 + cookie when the audit notification fan-out fails', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: NG_ID, parent_id: PARENT_ID, parent_name: 'P', parent_firm: 'PFirm',
    })
    mockQuery.mockRejectedValueOnce(new Error('CHECK constraint missing next_gen_shadow'))
    const res = await POST(buildReq('POST'))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') ?? '').toContain(SHADOW_COOKIE)
  })
})

describe('DELETE /api/me/shadow — clear shadow view', () => {
  it('401s when no x-user-id header is present', async () => {
    const res = await DELETE(buildReq('DELETE', { userId: null }))
    expect(res.status).toBe(401)
  })

  it('clears the ee_shadow_parent cookie with maxAge=0', async () => {
    const res = await DELETE(buildReq('DELETE'))
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SHADOW_COOKIE}=`)
    expect(setCookie).toMatch(/max-age=0/i)
  })

  it('clears even when no underlying link / DB state — does not query the DB', async () => {
    await DELETE(buildReq('DELETE'))
    expect(mockQueryOne).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

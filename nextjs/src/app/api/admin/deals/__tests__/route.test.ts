import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockIsUserAdmin = vi.fn()
const mockCreateDeal  = vi.fn()
const mockListAllDeals = vi.fn()

vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/deals', () => ({
  createDeal:    (...a: unknown[]) => mockCreateDeal(...a),
  listAllDeals:  (...a: unknown[]) => mockListAllDeals(...a),
}))

import { GET, POST } from '../route'

function buildReq(method: 'GET' | 'POST', body?: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/deals', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockIsUserAdmin.mockReset(); mockCreateDeal.mockReset(); mockListAllDeals.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/deals', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(buildReq('POST', { title: 'X', description: 'a'.repeat(30) }))).status).toBe(403)
  })

  it('rejects short title', async () => {
    expect((await POST(buildReq('POST', { title: 'x', description: 'a'.repeat(30) }))).status).toBe(400)
  })

  it('creates a deal with created_by = caller', async () => {
    mockCreateDeal.mockResolvedValueOnce({ id: 'd-1' })
    const res = await POST(buildReq('POST', {
      title: 'Deal X', description: 'a'.repeat(30),
    }))
    expect(res.status).toBe(201)
    expect(mockCreateDeal.mock.calls[0][0].created_by).toBe('a-1')
  })
})

describe('GET /api/admin/deals', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns the deals list', async () => {
    mockListAllDeals.mockResolvedValueOnce([{ id: 'd-1' }])
    expect((await (await GET(buildReq('GET'))).json()).deals).toHaveLength(1)
  })

  it('falls back to [] on DB error', async () => {
    mockListAllDeals.mockRejectedValueOnce(new Error('table missing'))
    expect((await (await GET(buildReq('GET'))).json()).deals).toEqual([])
  })
})

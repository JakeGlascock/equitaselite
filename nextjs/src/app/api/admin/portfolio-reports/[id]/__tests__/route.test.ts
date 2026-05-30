import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockQueryOne    = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { PATCH, DELETE } from '../route'

const ID = '00000000-0000-4000-8000-000000000000'

function buildReq(method: 'PATCH' | 'DELETE', body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': 'a-1', 'x-user-email': 'a@x.com',
  }
  return new NextRequest(`http://localhost/api/admin/portfolio-reports/${ID}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const params = (id = ID) => () => Promise.resolve({ id })

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/portfolio-reports/[id]', () => {
  it('forbids non-staff', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params()() })).status).toBe(403)
  })

  it('rejects a non-UUID id (404 Not found)', async () => {
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params('not-uuid')() })).status).toBe(404)
  })

  it('rejects an empty payload', async () => {
    expect((await PATCH(buildReq('PATCH', {}), { params: params()() })).status).toBe(400)
  })

  it('updates title and re-renders body_html when body changes', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { body: '## body with enough chars to pass the min check' }), { params: params()() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/body_html = \$/)
  })

  it('publishes / unpublishes', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { published: true }), { params: params()() })
    expect(mockQueryOne.mock.calls[0][0]).toMatch(/published_at = NOW\(\)/)
  })

  it('returns 404 when row not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params()() })).status).toBe(404)
  })
})

describe('DELETE /api/admin/portfolio-reports/[id]', () => {
  it('forbids non-staff', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await DELETE(buildReq('DELETE'), { params: params()() })).status).toBe(403)
  })

  it('rejects a non-UUID id', async () => {
    expect((await DELETE(buildReq('DELETE'), { params: params('bad')() })).status).toBe(404)
  })

  it('deletes the row', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    expect((await DELETE(buildReq('DELETE'), { params: params()() })).status).toBe(200)
  })
})

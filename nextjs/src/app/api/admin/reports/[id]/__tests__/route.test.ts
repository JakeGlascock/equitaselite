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

function buildReq(method: 'PATCH' | 'DELETE', body?: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest(`http://localhost/api/admin/reports/${ID}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const params = (id = ID) => () => Promise.resolve({ id })

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('PATCH /api/admin/reports/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params()() })).status).toBe(403)
  })

  it('rejects a non-UUID id (404 Not found)', async () => {
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params('not-uuid')() })).status).toBe(404)
  })

  it('rejects an empty payload (refine)', async () => {
    expect((await PATCH(buildReq('PATCH', {}), { params: params()() })).status).toBe(400)
  })

  it('updates title only (no body re-render)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params()() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/title = \$/)
    expect(sql).not.toMatch(/body_html =/)
  })

  it('re-renders body_html when body changes', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { body: '## new body with at least twenty chars of content' }), { params: params()() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/body_html = \$/)
  })

  it('published=true stamps NOW()', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { published: true }), { params: params()() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/published_at = NOW\(\)/)
  })

  it('published=false unpublishes (NULL)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(buildReq('PATCH', { published: false }), { params: params()() })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/published_at = NULL/)
  })

  it('returns 404 when row not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await PATCH(buildReq('PATCH', { title: 'New Title' }), { params: params()() })).status).toBe(404)
  })
})

describe('DELETE /api/admin/reports/[id]', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await DELETE(buildReq('DELETE'), { params: params()() })).status).toBe(403)
  })

  it('rejects a non-UUID id', async () => {
    expect((await DELETE(buildReq('DELETE'), { params: params('not-uuid')() })).status).toBe(404)
  })

  it('deletes the report', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    expect((await DELETE(buildReq('DELETE'), { params: params()() })).status).toBe(200)
  })
})

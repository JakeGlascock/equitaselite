import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))

import { PATCH } from '../route'

const ID    = 'managed_1'
const CONCIERGE = 'concierge-1'

function patchReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CONCIERGE
  return new NextRequest(`http://localhost/api/concierge/profiles/${ID}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => mockQueryOne.mockReset())

describe('PATCH /api/concierge/profiles/[id]', () => {
  it('requires authentication', async () => {
    const res = await PATCH(patchReq({ full_name: 'X' }, { userId: null }), { params: params() })
    expect(res.status).toBe(401)
  })

  it('rejects invalid payload', async () => {
    const res = await PATCH(patchReq({ role: 'investor' }), { params: params() })
    expect(res.status).toBe(400)
  })

  it('scopes UPDATE by managed_by = caller (cross-concierge defense)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: ID })
    await PATCH(patchReq({ full_name: 'New' }), { params: params() })
    const [sql, args] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/WHERE id = \$1 AND managed_by = \$2/)
    expect(args[0]).toBe(ID)
    expect(args[1]).toBe(CONCIERGE)
  })

  it('returns 404 if the row is not managed by the caller', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ full_name: 'X' }), { params: params() })
    expect(res.status).toBe(404)
  })
})

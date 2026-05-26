import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne            = vi.fn()
const mockGetEffectiveUserId  = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))

import { PATCH } from '../route'

const ID   = 'notif-1'
const USER = 'user-a'

function req(): NextRequest {
  return new NextRequest(`http://localhost/api/notifications/${ID}`, { method: 'PATCH' })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => {
  mockQueryOne.mockReset(); mockGetEffectiveUserId.mockReset()
})

describe('PATCH /api/notifications/[id]', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    expect((await PATCH(req(), { params: params() })).status).toBe(401)
  })

  it('marks the row read AND scopes by user_id (no cross-tenant read)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    mockQueryOne.mockResolvedValueOnce({ id: ID })

    const res = await PATCH(req(), { params: params() })

    expect(res.status).toBe(200)
    const [sql, args] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/SET is_read = TRUE/)
    expect(sql).toMatch(/WHERE id = \$1 AND user_id = \$2/)
    expect(args).toEqual([ID, USER])
  })

  it('returns 404 when the row does not belong to the caller', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(USER)
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await PATCH(req(), { params: params() })).status).toBe(404)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockGetEffectiveUserId  = vi.fn()

vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))

import { GET } from '../route'

function req(): NextRequest {
  return new NextRequest('http://localhost/api/notifications')
}

beforeEach(() => {
  mockQuery.mockReset(); mockGetEffectiveUserId.mockReset()
})

describe('GET /api/notifications', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    expect((await GET(req())).status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns the latest 50 rows scoped to the caller', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQuery.mockResolvedValueOnce([{ id: 'n-1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/LIMIT 50/)
    expect(sql).toMatch(/WHERE user_id = \$1/)
    expect(args).toEqual(['user-1'])
  })

  it('returns [] when the table does not exist yet (early-stage env)', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-1')
    mockQuery.mockRejectedValueOnce(new Error('relation "notifications" does not exist'))
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

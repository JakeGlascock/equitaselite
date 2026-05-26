import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockGetEffectiveUserId  = vi.fn()

vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/acting-as', () => ({
  getEffectiveUserId: (...a: unknown[]) => mockGetEffectiveUserId(...a),
}))

import { POST } from '../route'

function req(): NextRequest {
  return new NextRequest('http://localhost/api/notifications/mark-all-read', { method: 'POST' })
}

beforeEach(() => {
  mockQuery.mockReset(); mockGetEffectiveUserId.mockReset()
})

describe('POST /api/notifications/mark-all-read', () => {
  it('requires authentication', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce(null)
    expect((await POST(req())).status).toBe(401)
  })

  it('updates only the caller\'s unread rows', async () => {
    mockGetEffectiveUserId.mockResolvedValueOnce('user-a')
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(req())
    expect(res.status).toBe(200)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/UPDATE notifications/)
    expect(sql).toMatch(/WHERE user_id = \$1 AND is_read = FALSE/)
    expect(args).toEqual(['user-a'])
  })
})

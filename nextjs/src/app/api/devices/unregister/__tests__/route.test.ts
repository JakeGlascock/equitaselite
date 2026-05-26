import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn()

vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))

import { POST } from '../route'

const USER  = 'user-a'
const TOKEN = 'a'.repeat(64)

function postReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? USER
  return new NextRequest('http://localhost/api/devices/unregister', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue(undefined)
})

describe('POST /api/devices/unregister', () => {
  it('requires authentication', async () => {
    const res = await POST(postReq({ platform: 'ios', token: TOKEN }, { userId: null }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid payload', async () => {
    const res = await POST(postReq({ platform: 'ios' }))
    expect(res.status).toBe(400)
  })

  it('scopes the UPDATE by user_id so stolen sessions cannot revoke other users\' tokens', async () => {
    const res = await POST(postReq({ platform: 'ios', token: TOKEN }))
    expect(res.status).toBe(200)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/UPDATE device_tokens/)
    expect(sql).toMatch(/WHERE user_id  = \$1/)
    expect(sql).toMatch(/AND platform = \$2/)
    expect(sql).toMatch(/AND token    = \$3/)
    expect(sql).toMatch(/revoked_at IS NULL/)
    expect(args).toEqual([USER, 'ios', TOKEN])
  })
})

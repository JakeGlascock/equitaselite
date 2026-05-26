import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn()

vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))

import { POST } from '../route'

function postReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'u-1'
  return new NextRequest('http://localhost/api/walkthrough', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue(undefined)
})

describe('POST /api/walkthrough', () => {
  it('requires authentication', async () => {
    expect((await POST(postReq({ action: 'complete' }, { userId: null }))).status).toBe(401)
  })

  it('rejects unknown actions', async () => {
    expect((await POST(postReq({ action: 'wat' }))).status).toBe(400)
  })

  it('"complete" stamps walkthrough_seen_at = NOW()', async () => {
    await POST(postReq({ action: 'complete' }))
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/walkthrough_seen_at = NOW\(\)/)
  })

  it('"replay" nulls walkthrough_seen_at', async () => {
    await POST(postReq({ action: 'replay' }))
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/walkthrough_seen_at = NULL/)
  })
})

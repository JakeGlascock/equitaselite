import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery             = vi.fn()
const mockEnsureSnsEndpoint = vi.fn()

vi.mock('@/lib/db',   () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/push', () => ({ ensureSnsEndpoint: (...a: unknown[]) => mockEnsureSnsEndpoint(...a) }))

import { POST } from '../route'

const USER  = 'user-a'
const TOKEN = 'a'.repeat(64)

function postReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? USER
  return new NextRequest('http://localhost/api/devices/register', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockEnsureSnsEndpoint.mockReset()
  mockEnsureSnsEndpoint.mockResolvedValue(null)
  mockQuery.mockResolvedValue(undefined)
})

describe('POST /api/devices/register', () => {
  it('requires authentication', async () => {
    const res = await POST(postReq({ platform: 'ios', token: TOKEN }, { userId: null }))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects unknown platforms', async () => {
    const res = await POST(postReq({ platform: 'symbian', token: TOKEN }))
    expect(res.status).toBe(400)
  })

  it('rejects suspiciously short tokens (< 16 chars)', async () => {
    const res = await POST(postReq({ platform: 'ios', token: 'short' }))
    expect(res.status).toBe(400)
  })

  it('rejects suspiciously long tokens (> 512 chars)', async () => {
    const res = await POST(postReq({ platform: 'ios', token: 'x'.repeat(600) }))
    expect(res.status).toBe(400)
  })

  it('upserts the row with ensureSnsEndpoint result', async () => {
    mockEnsureSnsEndpoint.mockResolvedValueOnce('arn:aws:sns:...:endpoint/abc')

    const res = await POST(postReq({ platform: 'ios', token: TOKEN, app_version: '1.0.0' }))

    expect(res.status).toBe(200)
    expect(mockEnsureSnsEndpoint).toHaveBeenCalledWith('ios', TOKEN)
    const [sql, args] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO device_tokens/)
    expect(sql).toMatch(/ON CONFLICT \(platform, token\)/)
    expect(args).toEqual([USER, 'ios', TOKEN, '1.0.0', 'arn:aws:sns:...:endpoint/abc'])
  })

  it('still inserts when SNS endpoint creation returns null (stub provider / web platform)', async () => {
    mockEnsureSnsEndpoint.mockResolvedValueOnce(null)
    const res = await POST(postReq({ platform: 'web', token: TOKEN }))
    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalled()
  })
})

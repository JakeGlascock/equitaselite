import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockListPasskeys = vi.fn()

vi.mock('@/lib/auth', () => ({
  listPasskeys: (...a: unknown[]) => mockListPasskeys(...a),
}))

import { GET } from '../route'

function req(opts: { userId?: string | null; access?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null)  headers['x-user-id'] = opts.userId ?? 'u-1'
  if (opts.access !== null)  headers.cookie = `ee_access=${opts.access ?? 'token'}`
  return new NextRequest('http://localhost/api/auth/passkey/list', { headers })
}

beforeEach(() => mockListPasskeys.mockReset())

describe('GET /api/auth/passkey/list', () => {
  it('requires x-user-id', async () => {
    const res = await GET(req({ userId: null }))
    expect(res.status).toBe(401)
    expect(mockListPasskeys).not.toHaveBeenCalled()
  })

  it('requires ee_access cookie', async () => {
    const res = await GET(req({ access: null }))
    expect(res.status).toBe(401)
  })

  it('returns the passkey list from lib/auth', async () => {
    mockListPasskeys.mockResolvedValueOnce([{ id: 'cred-1', friendlyName: 'iPhone' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).passkeys).toHaveLength(1)
  })

  it('returns 500 on Cognito error', async () => {
    mockListPasskeys.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req())
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})

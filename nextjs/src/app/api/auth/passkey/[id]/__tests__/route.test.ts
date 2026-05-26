import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDeletePasskey = vi.fn()

vi.mock('@/lib/auth', () => ({
  deletePasskey: (...a: unknown[]) => mockDeletePasskey(...a),
}))

import { DELETE } from '../route'

function delReq(
  id: string,
  opts: { userId?: string | null; accessToken?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null)      headers['x-user-id'] = opts.userId ?? 'u-1'
  if (opts.accessToken !== null) headers.cookie = `ee_access=${opts.accessToken ?? 'token'}`
  return new NextRequest(`http://localhost/api/auth/passkey/${id}`, { method: 'DELETE', headers })
}
const params = (id: string) => () => Promise.resolve({ id })

beforeEach(() => mockDeletePasskey.mockReset())

describe('DELETE /api/auth/passkey/[id]', () => {
  it('requires x-user-id', async () => {
    const res = await DELETE(delReq('cred-1', { userId: null }), { params: params('cred-1')() })
    expect(res.status).toBe(401)
    expect(mockDeletePasskey).not.toHaveBeenCalled()
  })

  it('requires ee_access cookie', async () => {
    const res = await DELETE(delReq('cred-1', { accessToken: null }), { params: params('cred-1')() })
    expect(res.status).toBe(401)
  })

  it('forwards credentialId to lib/auth', async () => {
    mockDeletePasskey.mockResolvedValueOnce(undefined)
    const res = await DELETE(delReq('cred-1'), { params: params('cred-1')() })
    expect(res.status).toBe(200)
    expect(mockDeletePasskey).toHaveBeenCalledWith('token', 'cred-1')
  })

  it('returns 500 with a generic message when Cognito rejects', async () => {
    const e = new Error('boom'); e.name = 'InvalidParameterException'
    mockDeletePasskey.mockRejectedValueOnce(e)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await DELETE(delReq('cred-1'), { params: params('cred-1')() })

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not remove passkey.')
    errSpy.mockRestore()
  })
})

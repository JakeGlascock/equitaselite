import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const originalSecret = process.env.TURNSTILE_SECRET_KEY
const originalSite   = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { verifyTurnstile, turnstileSiteKey } from '../turnstile'

beforeEach(() => {
  fetchMock.mockReset()
  process.env.TURNSTILE_SECRET_KEY = ''
})

describe('verifyTurnstile', () => {
  it('returns true when TURNSTILE_SECRET_KEY is not set (dev mode)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await verifyTurnstile('any-token')).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns false when secret is set but no token is provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    expect(await verifyTurnstile(null)).toBe(false)
    expect(await verifyTurnstile(undefined)).toBe(false)
    expect(await verifyTurnstile('')).toBe(false)
  })

  it('returns true when Cloudflare success:true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true)
    // remoteip is included in the form body
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(body.get('remoteip')).toBe('1.2.3.4')
  })

  it('returns false on success:false', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) })
    expect(await verifyTurnstile('tok')).toBe(false)
  })

  it('returns false on non-2xx response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    expect(await verifyTurnstile('tok')).toBe(false)
  })

  it('returns false when fetch throws', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'shh'
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await verifyTurnstile('tok')).toBe(false)
    errSpy.mockRestore()
  })
})

describe('turnstileSiteKey', () => {
  it('returns the env value when set', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x-site-key'
    expect(turnstileSiteKey()).toBe('1x-site-key')
  })

  it('returns null when env unset', () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    expect(turnstileSiteKey()).toBeNull()
  })
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY
  else process.env.TURNSTILE_SECRET_KEY = originalSecret
  if (originalSite === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSite
})

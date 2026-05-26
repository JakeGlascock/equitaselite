import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery               = vi.fn()
const mockQueryOne            = vi.fn()
const mockVerifyTurnstile     = vi.fn()
const mockSendDemoMagicLink   = vi.fn()
const mockGenerateToken       = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/turnstile', () => ({
  verifyTurnstile: (...a: unknown[]) => mockVerifyTurnstile(...a),
}))
vi.mock('@/lib/demo-mail', () => ({
  sendDemoMagicLink: (...a: unknown[]) => mockSendDemoMagicLink(...a),
}))
vi.mock('@/lib/public-url', () => ({
  publicUrl: (_req: NextRequest, path: string) => new URL(path, 'http://localhost'),
}))
vi.mock('@/lib/preview', () => ({
  generateToken: (...a: unknown[]) => mockGenerateToken(...a),
}))

import { POST } from '../route'

const valid = {
  full_name: 'Sara Test', email: 'Sara@Example.com', firm_name: 'Test Capital',
  aum_range: '$50M–$250M', intended_use: 'Actively allocating',
  viewing_as_role: 'angel', turnstile_token: 't',
}

function postReq(body: unknown, opts: { ip?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.ip) headers['x-forwarded-for'] = opts.ip
  return new NextRequest('http://localhost/api/demo/signup', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
  mockVerifyTurnstile.mockReset(); mockSendDemoMagicLink.mockReset()
  mockGenerateToken.mockReset()
  mockVerifyTurnstile.mockResolvedValue(true)
  mockGenerateToken.mockReturnValue('magic-token-x')
})

describe('POST /api/demo/signup', () => {
  it('rejects invalid payload', async () => {
    expect((await POST(postReq({ email: 'a@b.com' }))).status).toBe(400)
  })

  it('rejects unknown role / aum_range', async () => {
    expect((await POST(postReq({ ...valid, viewing_as_role: 'space-cadet' }))).status).toBe(400)
  })

  it('rejects when Turnstile verification fails', async () => {
    mockVerifyTurnstile.mockResolvedValueOnce(false)
    expect((await POST(postReq(valid))).status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('enforces soft rate limit at 3 signups / 10 min per IP', async () => {
    mockQueryOne.mockResolvedValueOnce({ n: 3 })
    const res = await POST(postReq(valid, { ip: '1.2.3.4' }))
    expect(res.status).toBe(429)
  })

  it('lowercases email + inserts row + sends magic link', async () => {
    mockQueryOne.mockResolvedValueOnce({ n: 0 })
    mockQuery.mockResolvedValueOnce(undefined)
    mockSendDemoMagicLink.mockResolvedValueOnce(undefined)

    const res = await POST(postReq(valid, { ip: '1.2.3.4' }))

    expect(res.status).toBe(200)
    expect((await res.json()).expires_in_minutes).toBe(30)
    const [, args] = mockQuery.mock.calls[0]
    expect(args[0]).toBe('magic-token-x')
    expect(args[2]).toBe('sara@example.com')      // lowercased
  })

  it('returns 500 if DB insert fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ n: 0 })
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(500)
    errSpy.mockRestore()
  })

  it('returns 200 even if magic-link email fails (row already on file)', async () => {
    mockQueryOne.mockResolvedValueOnce({ n: 0 })
    mockQuery.mockResolvedValueOnce(undefined)
    mockSendDemoMagicLink.mockRejectedValueOnce(new Error('SES'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(200)
    errSpy.mockRestore()
  })
})

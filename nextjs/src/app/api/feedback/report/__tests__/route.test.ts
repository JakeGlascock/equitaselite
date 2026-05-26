import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSesSend, mockQuery } = vi.hoisted(() => ({
  mockSesSend: vi.fn(),
  mockQuery:   vi.fn(),
}))

vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client:      vi.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}))
vi.mock('@/lib/email-staff', () => ({
  renderStaffEmailHtml: () => '<html/>',
  renderStaffEmailText: () => 'text',
  escapeHtml:           (s: string) => s,
}))
vi.mock('@/lib/preview', () => ({
  PREVIEW_COOKIE_NAME: 'ee_preview',
  isDemoProfileId:     (v: unknown) => typeof v === 'string' && v.startsWith('demo_'),
}))

import { POST } from '../route'

function postReq(body: unknown, opts: { previewCookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'user-agent':   'TestAgent/1.0',
  }
  if (opts.previewCookie) headers.cookie = `ee_preview=${opts.previewCookie}`
  return new NextRequest('http://localhost/api/feedback/report', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockSesSend.mockReset()
  mockSesSend.mockResolvedValue({})
})

const valid = {
  message: 'Found a bug on the dashboard',
  path: '/dashboard', type: 'bug',
}

describe('POST /api/feedback/report', () => {
  it('rejects too-short message', async () => {
    expect((await POST(postReq({ ...valid, message: 'x' }))).status).toBe(400)
  })

  it('rejects unknown type', async () => {
    expect((await POST(postReq({ ...valid, type: 'rant' }))).status).toBe(400)
  })

  it('returns 500 on DB insert failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(500)
    errSpy.mockRestore()
  })

  it('persists anonymous report (no user cookie) + sends staff email', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(postReq(valid))
    expect(res.status).toBe(201)
    const [, args] = mockQuery.mock.calls[0]
    expect(args[0]).toBeNull()                              // user_id null
    expect(mockSesSend).toHaveBeenCalled()
  })

  it('captures preview cookie demo_ prefix as user_id', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await POST(postReq(valid, { previewCookie: 'demo_sarah_chen' }))
    const [, args] = mockQuery.mock.calls[0]
    expect(args[0]).toBe('demo_sarah_chen')
  })

  it('ignores non-demo preview cookie value', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await POST(postReq(valid, { previewCookie: 'attacker-id' }))
    expect(mockQuery.mock.calls[0][1][0]).toBeNull()
  })

  it('falls back to legacy INSERT shape when type column is missing', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('column "type" does not exist'))
      .mockResolvedValueOnce(undefined)
    const res = await POST(postReq(valid))
    expect(res.status).toBe(201)
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('still returns 201 if SES fails', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    mockSesSend.mockRejectedValueOnce(new Error('SES'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(201)
    errSpy.mockRestore()
  })
})

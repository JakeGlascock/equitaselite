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

import { POST } from '../route'

const valid = {
  email: 'a@x.com', full_name: 'Alice', firm_name: 'Alpha LP', role: 'angel',
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockSesSend.mockReset()
  mockSesSend.mockResolvedValue({})
})

describe('POST /api/request-access', () => {
  it('rejects invalid payload', async () => {
    expect((await POST(postReq({ email: 'not-email' }))).status).toBe(400)
  })

  it('returns 500 if DB insert fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table missing'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(500)
    errSpy.mockRestore()
  })

  it('persists DB row and sends staff email on happy path', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(postReq(valid))
    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalled()
    expect(mockSesSend).toHaveBeenCalled()
  })

  it('still returns 200 if staff email fails (DB row is source of truth)', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    mockSesSend.mockRejectedValueOnce(new Error('SES outage'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(postReq(valid))).status).toBe(200)
    errSpy.mockRestore()
  })

  it('passes role enum through to DB', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await POST(postReq({ ...valid, role: 'family_office', notes: 'Looking for deal flow' }))
    const [, args] = mockQuery.mock.calls[0]
    expect(args[3]).toBe('family_office')
    expect(args[4]).toBe('Looking for deal flow')
  })
})

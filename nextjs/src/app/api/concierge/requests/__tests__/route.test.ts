import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted runs before vi.mock hoisting, so the factory below can
// safely capture mockSesSend. Plain consts would hit a TDZ here.
const { mockSesSend, mockQuery, mockQueryOne } = vi.hoisted(() => ({
  mockSesSend:  vi.fn(),
  mockQuery:    vi.fn(),
  mockQueryOne: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
// Mock SES at the SDK level — the route constructs the client inline.
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

const USER = 'user-a'

const validBody = (over: Record<string, unknown> = {}) => ({
  category: 'introduction',
  urgency:  'Within a week',
  details:  'I need help with vetting a counterparty for a Series B deal.',
  ...over,
})

function postReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? USER
  return new NextRequest('http://localhost/api/concierge/requests', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockSesSend.mockReset()
  mockSesSend.mockResolvedValue({})
})

describe('POST /api/concierge/requests', () => {
  it('requires authentication', async () => {
    expect((await POST(postReq(validBody(), { userId: null }))).status).toBe(401)
  })

  it('rejects category not in enum', async () => {
    const res = await POST(postReq(validBody({ category: 'lobbying' })))
    expect(res.status).toBe(400)
  })

  it('rejects too-short details', async () => {
    const res = await POST(postReq(validBody({ details: 'too short' })))
    expect(res.status).toBe(400)
  })

  it('returns 404 if the requester has no profile', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect((await POST(postReq(validBody()))).status).toBe(404)
  })

  it('inserts the DB row and sends the staff email', async () => {
    mockQueryOne.mockResolvedValueOnce({
      full_name: 'Alice', email: 'a@x.com', firm_name: 'Alpha', role: 'angel',
    })
    mockQuery.mockResolvedValueOnce(undefined)

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(201)
    expect(mockQuery).toHaveBeenCalled()
    expect(mockSesSend).toHaveBeenCalled()
  })

  it('returns 500 if the DB insert fails (no email sent)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      full_name: 'Alice', email: 'a@x.com', firm_name: 'Alpha', role: 'angel',
    })
    mockQuery.mockRejectedValueOnce(new Error('DB failure'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(500)
    expect(mockSesSend).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('returns 201 even if the staff email fails (DB row is the source of truth)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      full_name: 'Alice', email: 'a@x.com', firm_name: 'Alpha', role: 'family_office',
    })
    mockQuery.mockResolvedValueOnce(undefined)
    mockSesSend.mockRejectedValueOnce(new Error('SES outage'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })
})

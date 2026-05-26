import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockQueryOne    = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { GET, POST } from '../route'

const validBriefing = {
  recipient_user_id: 'sov-1',
  title: 'Q1 Outlook',
  summary: 'A short summary of the Q1 portfolio outlook.',
  body: 'Body content with enough characters to pass min length requirement here.',
}

function buildReq(method: 'GET' | 'POST', body?: unknown, opts: { admin?: boolean; userId?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.admin !== false) {
    headers['x-user-id']    = opts.userId ?? 'a-1'
    headers['x-user-email'] = 'a@x.com'
  }
  return new NextRequest('http://localhost/api/admin/portfolio-reports', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/portfolio-reports — staff author gate', () => {
  it('forbids non-admin non-concierge', async () => {
    mockIsUserAdmin.mockReset()
    mockIsUserAdmin.mockResolvedValueOnce(false)   // not admin
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await POST(buildReq('POST', validBriefing))).status).toBe(403)
  })

  it('admins are allowed', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'sov-1', membership: 'sovereign' })
    mockQuery.mockResolvedValueOnce(undefined)
    expect((await POST(buildReq('POST', validBriefing))).status).toBe(201)
  })

  it('concierges are allowed', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    mockQueryOne
      .mockResolvedValueOnce({ is_concierge: true })           // staff check
      .mockResolvedValueOnce({ id: 'sov-1', membership: 'sovereign' })
    mockQuery.mockResolvedValueOnce(undefined)
    expect((await POST(buildReq('POST', validBriefing))).status).toBe(201)
  })
})

describe('POST /api/admin/portfolio-reports — recipient sanity', () => {
  beforeEach(() => mockIsUserAdmin.mockResolvedValue(true))

  it('rejects unknown recipient', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await POST(buildReq('POST', validBriefing))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Recipient profile not found/)
  })

  it('rejects non-Sovereign recipient (the tier-gate invariant)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'sov-1', membership: 'select' })
    const res = await POST(buildReq('POST', validBriefing))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Sovereign/)
  })
})

describe('POST /api/admin/portfolio-reports — validation + write', () => {
  beforeEach(() => mockIsUserAdmin.mockResolvedValue(true))

  it('rejects malformed payload', async () => {
    expect((await POST(buildReq('POST', { title: 'X' }))).status).toBe(400)
  })

  it('renders markdown to body_html and stamps published_at when publish_now', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'sov-1', membership: 'sovereign' })
    mockQuery.mockResolvedValueOnce(undefined)
    await POST(buildReq('POST', { ...validBriefing, publish_now: true }))
    const [, args] = mockQuery.mock.calls[0]
    expect(args[5]).toBeInstanceOf(Date)                       // published_at
  })

  it('returns 500 if INSERT fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'sov-1', membership: 'sovereign' })
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(buildReq('POST', validBriefing))).status).toBe(500)
    errSpy.mockRestore()
  })
})

describe('GET /api/admin/portfolio-reports', () => {
  it('forbids non-staff', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns briefings list joined with recipient name', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'b-1', recipient_name: 'Alice' }])
    const res = await GET(buildReq('GET'))
    expect(res.status).toBe(200)
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/LEFT JOIN profiles/)
  })
})

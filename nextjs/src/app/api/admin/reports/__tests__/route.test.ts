import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db',    () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))

import { GET, POST } from '../route'

const validReport = {
  slug: 'state-of-ai', title: 'State of AI',
  summary: 'A short summary about the state of AI.',
  sector_tag: 'AI', body: '## Headline\n\nBody content here, long enough to pass min length.',
  min_tier: 'select',
}

function buildReq(method: 'GET' | 'POST', body?: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/reports', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/reports', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(buildReq('POST', validReport))).status).toBe(403)
  })

  it('rejects invalid slug format', async () => {
    expect((await POST(buildReq('POST', { ...validReport, slug: 'Bad Slug!' }))).status).toBe(400)
  })

  it('creates a draft (no publish)', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    const res = await POST(buildReq('POST', validReport))
    expect(res.status).toBe(201)
    const [, args] = mockQuery.mock.calls[0]
    expect(args[7]).toBeNull()                          // published_at
  })

  it('publishes immediately when publish_now: true', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await POST(buildReq('POST', { ...validReport, publish_now: true }))
    const [, args] = mockQuery.mock.calls[0]
    expect(args[7]).toBeInstanceOf(Date)
  })

  it('maps duplicate-slug to 409', async () => {
    mockQuery.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "reports_slug_key"'))
    expect((await POST(buildReq('POST', validReport))).status).toBe(409)
  })

  it('falls back to 500 on other DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('other'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(buildReq('POST', validReport))).status).toBe(500)
    errSpy.mockRestore()
  })
})

describe('GET /api/admin/reports', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns the reports list', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'r-1' }])
    expect((await (await GET(buildReq('GET'))).json()).reports).toHaveLength(1)
  })

  it('returns [] on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table missing'))
    expect((await (await GET(buildReq('GET'))).json()).reports).toEqual([])
  })
})

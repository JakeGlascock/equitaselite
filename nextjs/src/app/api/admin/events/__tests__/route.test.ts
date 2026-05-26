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

function buildReq(method: 'GET' | 'POST', body?: unknown, admin = true): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/events', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const validEvent = {
  title: 'Summit 2027', description: 'Annual event for top members',
  type: 'Summit', date: '2027-06-01T00:00:00Z', duration: '2 days',
  location: 'NYC', capacity: 100, min_tier: 'sovereign',
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('GET /api/admin/events', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns events with RSVP counts joined', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'e-1', registered: 5 }])
    const res = await GET(buildReq('GET'))
    expect(res.status).toBe(200)
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/LEFT JOIN event_rsvps/)
  })
})

describe('POST /api/admin/events', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(buildReq('POST', validEvent))).status).toBe(403)
  })

  it('rejects invalid date format', async () => {
    expect((await POST(buildReq('POST', { ...validEvent, date: 'tomorrow' }))).status).toBe(400)
  })

  it('rejects unknown event type', async () => {
    expect((await POST(buildReq('POST', { ...validEvent, type: 'Picnic' }))).status).toBe(400)
  })

  it('creates an event', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'e-1' })
    expect((await POST(buildReq('POST', validEvent))).status).toBe(201)
  })

  it('returns friendly 400 if events table is missing', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('relation "events" does not exist'))
    const res = await POST(buildReq('POST', validEvent))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/events table missing/)
  })

  it('falls back to 500 on other DB errors', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('weird'))
    expect((await POST(buildReq('POST', validEvent))).status).toBe(500)
  })
})

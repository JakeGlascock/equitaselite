import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne                  = vi.fn()
const mockListAnnotationsForConcierge = vi.fn()
const mockUpsertAnnotation          = vi.fn()
const mockLogConciergeAction        = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/concierge', () => ({
  listAnnotationsForConcierge: (...a: unknown[]) => mockListAnnotationsForConcierge(...a),
  upsertAnnotation:            (...a: unknown[]) => mockUpsertAnnotation(...a),
  logConciergeAction:          (...a: unknown[]) => mockLogConciergeAction(...a),
}))

import { GET, POST } from '../route'

const CONCIERGE = 'concierge-1'
const OTHER     = 'member-2'

function buildReq(method: 'GET' | 'POST', body?: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CONCIERGE
  return new NextRequest('http://localhost/api/concierge/annotations', {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockQueryOne.mockReset()
  mockListAnnotationsForConcierge.mockReset()
  mockUpsertAnnotation.mockReset()
  mockLogConciergeAction.mockReset()
  mockLogConciergeAction.mockResolvedValue(undefined)
})

describe('GET /api/concierge/annotations', () => {
  it('forbids non-concierges', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await GET(buildReq('GET'))).status).toBe(403)
  })

  it('returns the concierge\'s own annotations', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockListAnnotationsForConcierge.mockResolvedValueOnce([{ id: 'a-1' }])
    const res = await GET(buildReq('GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'a-1' }])
    expect(mockListAnnotationsForConcierge).toHaveBeenCalledWith(CONCIERGE)
  })
})

describe('POST /api/concierge/annotations', () => {
  it('forbids non-concierges', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await POST(buildReq('POST', { counterparty_id: OTHER, note: 'x' }))).status).toBe(403)
  })

  it('rejects missing/short note', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    expect((await POST(buildReq('POST', { counterparty_id: OTHER, note: '' }))).status).toBe(400)
  })

  it('blocks self-annotation (matches DB CHECK constraint)', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    const res = await POST(buildReq('POST', { counterparty_id: CONCIERGE, note: 'self' }))
    expect(res.status).toBe(400)
    expect(mockUpsertAnnotation).not.toHaveBeenCalled()
  })

  it('upserts and emits an audit log entry', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockUpsertAnnotation.mockResolvedValueOnce({
      id: 'ann-1', counterparty_id: OTHER, vouch_strength: 'know',
    })

    const res = await POST(buildReq('POST', {
      counterparty_id: OTHER, note: 'I have worked with them', vouch_strength: 'worked_with',
    }))

    expect(res.status).toBe(201)
    expect(mockUpsertAnnotation).toHaveBeenCalledWith({
      concierge_id: CONCIERGE, counterparty_id: OTHER,
      note: 'I have worked with them', vouch_strength: 'worked_with',
    })
    expect(mockLogConciergeAction).toHaveBeenCalled()
    expect(mockLogConciergeAction.mock.calls[0][0].action).toBe('annotation_upserted')
  })

  it('returns 500 if the upsert fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockUpsertAnnotation.mockResolvedValueOnce(null)
    expect((await POST(buildReq('POST', { counterparty_id: OTHER, note: 'x' }))).status).toBe(500)
  })

  it('swallows audit-log failures (annotation already persisted)', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockUpsertAnnotation.mockResolvedValueOnce({ id: 'a-1', counterparty_id: OTHER, vouch_strength: null })
    mockLogConciergeAction.mockRejectedValueOnce(new Error('audit down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildReq('POST', { counterparty_id: OTHER, note: 'x' }))
    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })
})

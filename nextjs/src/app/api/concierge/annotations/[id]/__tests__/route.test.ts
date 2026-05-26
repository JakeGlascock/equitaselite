import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne          = vi.fn()
const mockDeleteAnnotation  = vi.fn()
const mockLogConciergeAction = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/concierge', () => ({
  deleteAnnotation:   (...a: unknown[]) => mockDeleteAnnotation(...a),
  logConciergeAction: (...a: unknown[]) => mockLogConciergeAction(...a),
}))

import { DELETE } from '../route'

const ID        = 'ann-1'
const CONCIERGE = 'concierge-1'

function delReq(opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CONCIERGE
  return new NextRequest(`http://localhost/api/concierge/annotations/${ID}`, { method: 'DELETE', headers })
}
const params = () => Promise.resolve({ id: ID })

beforeEach(() => {
  mockQueryOne.mockReset(); mockDeleteAnnotation.mockReset(); mockLogConciergeAction.mockReset()
  mockLogConciergeAction.mockResolvedValue(undefined)
})

describe('DELETE /api/concierge/annotations/[id]', () => {
  it('forbids non-concierges', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: false })
    expect((await DELETE(delReq(), { params: params() })).status).toBe(403)
  })

  it('returns 404 if the annotation is not owned by the caller', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockDeleteAnnotation.mockResolvedValueOnce(false)
    expect((await DELETE(delReq(), { params: params() })).status).toBe(404)
  })

  it('passes (id, concierge_id) to deleteAnnotation — scoping is server-side', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockDeleteAnnotation.mockResolvedValueOnce(true)

    const res = await DELETE(delReq(), { params: params() })

    expect(res.status).toBe(200)
    expect(mockDeleteAnnotation).toHaveBeenCalledWith(ID, CONCIERGE)
    expect(mockLogConciergeAction.mock.calls[0][0].action).toBe('annotation_deleted')
  })

  it('survives audit log failures', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_concierge: true })
    mockDeleteAnnotation.mockResolvedValueOnce(true)
    mockLogConciergeAction.mockRejectedValueOnce(new Error('audit'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await DELETE(delReq(), { params: params() })
    expect(res.status).toBe(200)
    errSpy.mockRestore()
  })
})

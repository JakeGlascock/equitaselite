import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))

import { PATCH } from '../route'

const validWeights = {
  scope: 20, capital: 20, timeRisk: 15,
  governance: 15, counterparty: 15, values: 15,
}

function patchReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'u-1'
  return new NextRequest('http://localhost/api/me/mandate-weights', {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => mockQueryOne.mockReset())

describe('PATCH /api/me/mandate-weights', () => {
  it('requires authentication', async () => {
    expect((await PATCH(patchReq(validWeights, { userId: null }))).status).toBe(401)
  })

  it('rejects when weights do not sum to 100', async () => {
    const res = await PATCH(patchReq({ ...validWeights, values: 14 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/sum to 100/i)
  })

  it('rejects a missing pillar', async () => {
    const partial = { ...validWeights } as Partial<typeof validWeights>
    delete partial.values
    const res = await PATCH(patchReq(partial))
    expect(res.status).toBe(400)
  })

  it('rejects out-of-range values', async () => {
    const res = await PATCH(patchReq({ ...validWeights, scope: 120, values: -85 }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if the row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq(validWeights))
    expect(res.status).toBe(404)
  })

  it('persists weights as JSONB and returns them', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'u-1', mandate_weights: validWeights })
    const res = await PATCH(patchReq(validWeights))
    expect(res.status).toBe(200)
    const [sql, args] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/mandate_weights = \$2::jsonb/)
    expect(JSON.parse(args[1])).toEqual(validWeights)
  })
})

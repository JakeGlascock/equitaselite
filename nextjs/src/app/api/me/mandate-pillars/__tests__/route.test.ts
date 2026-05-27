import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))

import { PATCH } from '../route'

function patchReq(body: unknown, opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? 'u-1'
  return new NextRequest('http://localhost/api/me/mandate-pillars', {
    method: 'PATCH', headers, body: JSON.stringify(body),
  })
}

beforeEach(() => mockQueryOne.mockReset())

describe('PATCH /api/me/mandate-pillars', () => {
  it('requires authentication', async () => {
    const res = await PATCH(patchReq({ esg_required: true }, { userId: null }))
    expect(res.status).toBe(401)
  })

  it('rejects an empty payload (refine: at least one field)', async () => {
    const res = await PATCH(patchReq({}))
    expect(res.status).toBe(400)
  })

  it('rejects an over-long sub_sectors array', async () => {
    const long = Array.from({ length: 50 }, (_, i) => `s-${i}`)
    const res = await PATCH(patchReq({ sub_sectors: long }))
    expect(res.status).toBe(400)
  })

  it('rejects unknown enum values', async () => {
    const res = await PATCH(patchReq({ lead_capacity: 'lurker' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if the profile row does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const res = await PATCH(patchReq({ esg_required: true }))
    expect(res.status).toBe(404)
  })

  it('updates the pillar fields and returns the row', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'u-1', esg_required: true })
    const res = await PATCH(patchReq({
      sub_sectors: ['AI', 'Health'],
      lead_capacity: 'lead',
      holding_period_target_years: 7,
      esg_required: true,
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).esg_required).toBe(true)
  })

  it('allows explicit-null to clear a value (CASE WHEN pattern)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'u-1', lead_capacity: null })
    const res = await PATCH(patchReq({ lead_capacity: null }))
    expect(res.status).toBe(200)
  })

  it('accepts asset_classes (P1) — persists to the asset_classes column', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'u-1', asset_classes: ['PRIVATE_CREDIT', 'INFRASTRUCTURE'],
    })
    const res = await PATCH(patchReq({
      asset_classes: ['PRIVATE_CREDIT', 'INFRASTRUCTURE'],
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).asset_classes).toEqual(['PRIVATE_CREDIT', 'INFRASTRUCTURE'])
    // Last bound param is asset_classes (param $20 in the SQL).
    const args = mockQueryOne.mock.calls[0][1] as unknown[]
    expect(args[args.length - 1]).toEqual(['PRIVATE_CREDIT', 'INFRASTRUCTURE'])
  })
})

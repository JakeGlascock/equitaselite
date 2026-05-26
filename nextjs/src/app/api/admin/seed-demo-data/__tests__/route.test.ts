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

import { POST } from '../route'

function req(admin = true): NextRequest {
  const headers: Record<string, string> = {}
  if (admin) { headers['x-user-id'] = 'a-1'; headers['x-user-email'] = 'a@x.com' }
  return new NextRequest('http://localhost/api/admin/seed-demo-data', { method: 'POST', headers })
}

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/seed-demo-data', () => {
  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(req())).status).toBe(403)
  })

  it('upserts demo profiles with membership column when present', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '0' })          // existing demos
    mockQuery.mockResolvedValue(undefined)                       // membership probe + every INSERT

    const res = await POST(req())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.membershipAssigned).toBe(true)
    expect(body.upserted).toBeGreaterThan(0)
    // First call after the count is the membership-column probe.
    const inserts = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO profiles'),
    )
    expect(inserts.length).toBe(body.upserted)
  })

  it('falls back to legacy INSERT when membership column is missing', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '0' })
    mockQuery
      .mockRejectedValueOnce(new Error('column "membership" does not exist')) // probe fails
      .mockResolvedValue(undefined)

    const res = await POST(req())

    const body = await res.json()
    expect(body.membershipAssigned).toBe(false)
    expect(body.upserted).toBeGreaterThan(0)
    // Legacy INSERT should NOT reference the membership column.
    const sampleInsert = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO profiles'),
    )?.[0] as string
    expect(sampleInsert).not.toMatch(/membership/)
  })

  it('returns the prior demo-profile count for diff-tracking', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '7' })
    mockQuery.mockResolvedValue(undefined)
    const res = await POST(req())
    expect((await res.json()).rowsBefore).toBe(7)
  })

  it('tolerates a null count row (treats as 0)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    mockQuery.mockResolvedValue(undefined)
    expect((await (await POST(req())).json()).rowsBefore).toBe(0)
  })
})

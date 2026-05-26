import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))

import { getMandate, getMandatesForProfile } from '../mandates'

beforeEach(() => {
  mockQuery.mockReset(); mockQueryOne.mockReset()
})

describe('getMandate', () => {
  it('returns the row scoped to (profile_id, role)', async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: 'u-1', role: 'angel' })
    const m = await getMandate('u-1', 'angel')
    expect(m?.role).toBe('angel')
    const [sql, args] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/WHERE profile_id = \$1 AND role = \$2/)
    expect(args).toEqual(['u-1', 'angel'])
  })

  it('returns null on DB error (table missing pre-034)', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('relation "mandates" does not exist'))
    expect(await getMandate('u-1', 'family_office')).toBeNull()
  })

  it('returns null when no row exists', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect(await getMandate('u-1', 'angel')).toBeNull()
  })
})

describe('getMandatesForProfile', () => {
  it('returns all mandates for the profile', async () => {
    mockQuery.mockResolvedValueOnce([
      { profile_id: 'u-1', role: 'angel' },
      { profile_id: 'u-1', role: 'family_office' },
    ])
    expect(await getMandatesForProfile('u-1')).toHaveLength(2)
  })

  it('returns [] on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('table missing'))
    expect(await getMandatesForProfile('u-1')).toEqual([])
  })

  it('returns [] when there are no rows', async () => {
    mockQuery.mockResolvedValueOnce([])
    expect(await getMandatesForProfile('u-1')).toEqual([])
  })
})

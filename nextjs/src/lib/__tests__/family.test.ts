import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

import {
  getParent,
  listNextGenSeats,
  linkNextGen,
  unlinkNextGen,
} from '../family'

beforeEach(() => {
  mockQuery.mockReset()
  mockQueryOne.mockReset()
})

describe('getParent', () => {
  it('joins through parent_profile_id and returns the parent row', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'parent-1', full_name: 'Parent', firm_name: 'Firm', role: 'family_office',
    })
    const r = await getParent('next-gen-1')
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('JOIN profiles p ON p.id = me.parent_profile_id')
    expect(sql).toContain('WHERE me.id = $1')
    expect(params).toEqual(['next-gen-1'])
    expect(r?.id).toBe('parent-1')
  })

  it('returns null on db error so /profile still renders pre-043', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('column parent_profile_id does not exist'))
    expect(await getParent('next-gen-1')).toBeNull()
  })
})

describe('listNextGenSeats', () => {
  it('selects every profile with parent_profile_id = $1 ordered by name', async () => {
    mockQuery.mockResolvedValueOnce([])
    await listNextGenSeats('parent-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('WHERE parent_profile_id = $1')
    expect(sql).toContain('ORDER BY full_name')
    expect(params).toEqual(['parent-1'])
  })

  it('returns [] on db error (pre-043 safety)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('schema missing'))
    expect(await listNextGenSeats('parent-1')).toEqual([])
  })
})

describe('linkNextGen — validation', () => {
  it('rejects self-link (parentId === nextGenId)', async () => {
    const r = await linkNextGen('same-id', 'same-id')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/cannot shadow itself/i)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects when target profile is missing', async () => {
    mockQueryOne.mockResolvedValueOnce(null)        // target lookup
    const r = await linkNextGen('parent-1', 'missing')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Next-gen profile not found/)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects when target does not have is_next_gen = TRUE', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'plain-fo', is_next_gen: false })
    const r = await linkNextGen('parent-1', 'plain-fo')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/must have the Next-Gen role flag/i)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects when parent profile is missing', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ng-1', is_next_gen: true })   // target ok
      .mockResolvedValueOnce(null)                                // parent missing
    const r = await linkNextGen('missing-parent', 'ng-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Parent profile not found/)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('writes parent_profile_id when both profiles validate', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ng-1', is_next_gen: true })
      .mockResolvedValueOnce({ id: 'parent-1' })
    mockQuery.mockResolvedValueOnce(undefined)

    const r = await linkNextGen('parent-1', 'ng-1')
    expect(r.ok).toBe(true)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('UPDATE profiles SET parent_profile_id = $2')
    expect(sql).toContain('WHERE id = $1')
    // Params order: (nextGenId, parentId) — the WHERE matches the
    // next-gen row whose link is being set.
    expect(params).toEqual(['ng-1', 'parent-1'])
  })
})

describe('unlinkNextGen', () => {
  it('NULLs parent_profile_id for the next-gen row', async () => {
    mockQuery.mockResolvedValueOnce(undefined)
    await unlinkNextGen('ng-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('UPDATE profiles SET parent_profile_id = NULL')
    expect(sql).toContain('WHERE id = $1')
    expect(params).toEqual(['ng-1'])
  })
})

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
  isLinkEligible,
  createLinkRequest,
  listIncomingLinkRequests,
  listOutgoingLinkRequests,
  acceptLinkRequest,
  declineLinkRequest,
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

// ─── P5f — cross-account link request lifecycle ──────────────────

const ELIGIBLE_TARGET = {
  id: 'tgt-1',
  parent_profile_id: null,
  is_admin: false,
  is_concierge: false,
  is_demo: false,
  is_family_office: false,
  is_family_foundation: false,
  is_daf: false,
}

describe('isLinkEligible — silent gate for cross-account linking', () => {
  it('returns true for a vanilla profile with no parent + no role conflict', () => {
    expect(isLinkEligible(ELIGIBLE_TARGET, 'requester-1')).toBe(true)
  })

  it('returns false when target is the requester (self-link)', () => {
    expect(isLinkEligible({ ...ELIGIBLE_TARGET, id: 'requester-1' }, 'requester-1')).toBe(false)
  })

  it('returns false when target already has a parent', () => {
    expect(isLinkEligible({ ...ELIGIBLE_TARGET, parent_profile_id: 'p-x' }, 'requester-1')).toBe(false)
  })

  it.each([
    ['is_admin'],
    ['is_concierge'],
    ['is_demo'],
    ['is_family_office'],
    ['is_family_foundation'],
    ['is_daf'],
  ])('returns false when target has %s = true', flag => {
    expect(isLinkEligible({ ...ELIGIBLE_TARGET, [flag]: true }, 'requester-1')).toBe(false)
  })
})

describe('createLinkRequest', () => {
  it('returns null silently when target is ineligible (admin) — no info leak', async () => {
    mockQueryOne.mockResolvedValueOnce({ ...ELIGIBLE_TARGET, is_admin: true })
    const r = await createLinkRequest('req-1', 'tgt-1')
    expect(r).toBeNull()
    // Crucially: the INSERT is never attempted.
    expect(mockQueryOne).toHaveBeenCalledTimes(1)
  })

  it('inserts a pending request on the happy path', async () => {
    mockQueryOne
      .mockResolvedValueOnce(ELIGIBLE_TARGET)
      .mockResolvedValueOnce({ id: 'req-row-1', requester_id: 'req-1', target_id: 'tgt-1', status: 'pending' })
    const r = await createLinkRequest('req-1', 'tgt-1')
    expect(r?.id).toBe('req-row-1')
    const [insertSql, insertParams] = mockQueryOne.mock.calls[1]
    expect(insertSql).toContain('INSERT INTO family_link_requests')
    expect(insertParams).toEqual(['req-1', 'tgt-1'])
  })

  it('returns null on duplicate-pending (partial unique fires) — idempotent re-click', async () => {
    mockQueryOne
      .mockResolvedValueOnce(ELIGIBLE_TARGET)
      .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
    expect(await createLinkRequest('req-1', 'tgt-1')).toBeNull()
  })
})

describe('acceptLinkRequest', () => {
  const PENDING_REQ = {
    id: 'r-1', requester_id: 'req-1', target_id: 'tgt-1', status: 'pending',
  }

  it('404s when the request does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    const r = await acceptLinkRequest('r-1', 'tgt-1')
    expect(r).toEqual({ ok: false, error: 'Request not found.' })
  })

  it('404s when caller is not the target (single error — no info leak)', async () => {
    mockQueryOne.mockResolvedValueOnce({ ...PENDING_REQ, target_id: 'someone-else' })
    const r = await acceptLinkRequest('r-1', 'tgt-1')
    expect(r).toEqual({ ok: false, error: 'Request not found.' })
  })

  it('409s when the request is already responded to', async () => {
    mockQueryOne.mockResolvedValueOnce({ ...PENDING_REQ, status: 'accepted' })
    const r = await acceptLinkRequest('r-1', 'tgt-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already responded/i)
  })

  it('rejects accept when target now has a parent (race-safe re-check)', async () => {
    mockQueryOne
      .mockResolvedValueOnce(PENDING_REQ)
      .mockResolvedValueOnce({ ...ELIGIBLE_TARGET, parent_profile_id: 'p-x' })
    const r = await acceptLinkRequest('r-1', 'tgt-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already linked/i)
  })

  it('on success: sets parent_profile_id + is_next_gen on the target and flips the request', async () => {
    mockQueryOne
      .mockResolvedValueOnce(PENDING_REQ)
      .mockResolvedValueOnce(ELIGIBLE_TARGET)
    mockQuery.mockResolvedValue([])
    const r = await acceptLinkRequest('r-1', 'tgt-1')
    expect(r).toEqual({ ok: true })

    const profileUpdate = mockQuery.mock.calls[0]
    expect(profileUpdate[0]).toContain('UPDATE profiles')
    expect(profileUpdate[0]).toContain('parent_profile_id = $2')
    expect(profileUpdate[0]).toContain('is_next_gen        = TRUE')
    expect(profileUpdate[1]).toEqual(['tgt-1', 'req-1'])

    const reqFlip = mockQuery.mock.calls[1]
    expect(reqFlip[0]).toContain("status = 'accepted'")
    expect(reqFlip[1]).toEqual(['r-1'])
  })
})

describe('declineLinkRequest', () => {
  const PENDING_REQ = {
    id: 'r-1', requester_id: 'req-1', target_id: 'tgt-1', status: 'pending',
  }

  it('404s when not yours', async () => {
    mockQueryOne.mockResolvedValueOnce({ ...PENDING_REQ, target_id: 'else' })
    const r = await declineLinkRequest('r-1', 'tgt-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not found/i)
  })

  it('flips status to declined on success and does NOT touch profiles', async () => {
    mockQueryOne.mockResolvedValueOnce(PENDING_REQ)
    mockQuery.mockResolvedValue([])
    const r = await declineLinkRequest('r-1', 'tgt-1')
    expect(r).toEqual({ ok: true })
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain("status = 'declined'")
    expect(params).toEqual(['r-1'])
  })
})

describe('listIncomingLinkRequests + listOutgoingLinkRequests', () => {
  it('incoming filters by target + status=pending, joins requester', async () => {
    mockQuery.mockResolvedValueOnce([])
    await listIncomingLinkRequests('tgt-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('LEFT JOIN profiles req ON req.id = r.requester_id')
    expect(sql).toContain("r.target_id = $1 AND r.status = 'pending'")
    expect(params).toEqual(['tgt-1'])
  })

  it('outgoing filters by requester + status=pending, joins target', async () => {
    mockQuery.mockResolvedValueOnce([])
    await listOutgoingLinkRequests('req-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('LEFT JOIN profiles tgt ON tgt.id = r.target_id')
    expect(sql).toContain("r.requester_id = $1 AND r.status = 'pending'")
    expect(params).toEqual(['req-1'])
  })

  it('both return [] on db error (pre-047 safety)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation does not exist'))
    expect(await listIncomingLinkRequests('x')).toEqual([])
    mockQuery.mockRejectedValueOnce(new Error('relation does not exist'))
    expect(await listOutgoingLinkRequests('x')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { quickVisibility, visibilityWhereFragment } from '../visibility'

describe('quickVisibility', () => {
  const VIEWER  = 'viewer_1'
  const TARGET  = 'target_1'
  const baseCtx = { viewerId: VIEWER, viewerIsAdmin: false }

  it('returns true when viewer is the target (self)', () => {
    const r = quickVisibility(baseCtx, { id: VIEWER, is_off_market: true })
    expect(r).toBe(true)
  })

  it('returns true when target is not off-market', () => {
    const r = quickVisibility(baseCtx, { id: TARGET, is_off_market: false })
    expect(r).toBe(true)
  })

  it('returns true when target.is_off_market is null/undefined (legacy rows)', () => {
    expect(quickVisibility(baseCtx, { id: TARGET, is_off_market: null })).toBe(true)
    expect(quickVisibility(baseCtx, { id: TARGET })).toBe(true)
  })

  it('returns true when viewer is admin even if target is off-market', () => {
    const r = quickVisibility({ ...baseCtx, viewerIsAdmin: true }, { id: TARGET, is_off_market: true })
    expect(r).toBe(true)
  })

  it('returns true when viewer is the target\'s assigned RM', () => {
    const r = quickVisibility(baseCtx, {
      id: TARGET, is_off_market: true, relationship_manager_id: VIEWER,
    })
    expect(r).toBe(true)
  })

  it('returns needs-connection-check when off-market and viewer is none of self/admin/RM', () => {
    const r = quickVisibility(baseCtx, {
      id: TARGET, is_off_market: true, relationship_manager_id: 'someone_else',
    })
    expect(r).toBe('needs-connection-check')
  })

  it('returns needs-connection-check when relationship_manager_id is null', () => {
    const r = quickVisibility(baseCtx, { id: TARGET, is_off_market: true, relationship_manager_id: null })
    expect(r).toBe('needs-connection-check')
  })
})

describe('visibilityWhereFragment', () => {
  it('embeds the viewerId param index in every reference', () => {
    const sql = visibilityWhereFragment('p', 3)
    // viewerId is referenced at four sites: self / RM / admin-exists / both intro sides
    const occurrences = sql.match(/\$3/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(4)
  })

  it('uses the provided profile alias consistently', () => {
    const sql = visibilityWhereFragment('alias_x', 1)
    expect(sql).toContain('alias_x.is_off_market = FALSE')
    expect(sql).toContain('alias_x.id = $1')
    expect(sql).toContain('alias_x.relationship_manager_id = $1')
  })

  it('checks both directions of the introduction (requester/recipient)', () => {
    const sql = visibilityWhereFragment('p', 1)
    expect(sql).toContain('i.requester_id = $1 AND i.recipient_id = p.id')
    expect(sql).toContain('i.requester_id = p.id AND i.recipient_id = $1')
  })

  it('only counts accepted introductions as a visibility grant', () => {
    const sql = visibilityWhereFragment('p', 1)
    expect(sql).toContain("status = 'accepted'")
  })

  it('falls back to admin-EXISTS for elevated viewers (no separate param)', () => {
    const sql = visibilityWhereFragment('p', 1)
    expect(sql).toContain('a.is_admin = TRUE')
  })
})

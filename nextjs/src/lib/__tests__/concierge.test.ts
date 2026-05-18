import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQuery    = vi.fn()
const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  query:    (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

import {
  listAnnotationsForConcierge,
  getAnnotationForCounterparty,
  upsertAnnotation,
  deleteAnnotation,
  logConciergeAction,
  recentConciergeActions,
} from '../concierge'

beforeEach(() => {
  mockQuery.mockReset()
  mockQueryOne.mockReset()
})

describe('listAnnotationsForConcierge', () => {
  it('selects by concierge_id ordered by updated_at DESC, default limit 200', async () => {
    mockQuery.mockResolvedValueOnce([])
    await listAnnotationsForConcierge('chelsea-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('WHERE concierge_id = $1')
    expect(sql).toContain('ORDER BY updated_at DESC')
    expect(params).toEqual(['chelsea-1', 200])
  })

  it('honors a custom limit', async () => {
    mockQuery.mockResolvedValueOnce([])
    await listAnnotationsForConcierge('chelsea-1', 25)
    expect(mockQuery.mock.calls[0][1]).toEqual(['chelsea-1', 25])
  })
})

describe('getAnnotationForCounterparty', () => {
  it('looks up the unique (concierge, counterparty) pair', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    await getAnnotationForCounterparty('chelsea-1', 'firm-2')
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('WHERE concierge_id = $1 AND counterparty_id = $2')
    expect(params).toEqual(['chelsea-1', 'firm-2'])
  })

  it('returns null when no annotation exists', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect(await getAnnotationForCounterparty('chelsea-1', 'firm-2')).toBeNull()
  })
})

describe('upsertAnnotation', () => {
  it('inserts a new annotation with default visibility=private', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'a1', visibility: 'private' })
    await upsertAnnotation({
      concierge_id:    'chelsea-1',
      counterparty_id: 'firm-2',
      note:            'Met at SXSW',
      vouch_strength:  'know',
    })
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('INSERT INTO concierge_annotations')
    expect(sql).toContain('ON CONFLICT (concierge_id, counterparty_id) DO UPDATE')
    expect(params).toEqual(['chelsea-1', 'firm-2', 'Met at SXSW', 'know'])
  })

  it('updates note + vouch on conflict (idempotent upsert)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'a1' })
    await upsertAnnotation({
      concierge_id:    'chelsea-1',
      counterparty_id: 'firm-2',
      note:            'Updated note',
    })
    const [sql] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('SET note = EXCLUDED.note')
    expect(sql).toContain('vouch_strength = EXCLUDED.vouch_strength')
  })

  it('omits vouch_strength as null when not provided', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'a1' })
    await upsertAnnotation({
      concierge_id:    'chelsea-1',
      counterparty_id: 'firm-2',
      note:            'Just a note',
    })
    expect(mockQueryOne.mock.calls[0][1][3]).toBeNull()
  })

  it('does NOT expose a visibility parameter on the public API', async () => {
    // Compile-time guard would be ideal but the runtime check works too:
    // there should be no fifth parameter in the bound args.
    mockQueryOne.mockResolvedValueOnce({ id: 'a1' })
    await upsertAnnotation({
      concierge_id:    'chelsea-1',
      counterparty_id: 'firm-2',
      note:            'X',
    })
    const params = mockQueryOne.mock.calls[0][1]
    expect(params).toHaveLength(4)  // concierge, counterparty, note, vouch_strength
  })
})

describe('deleteAnnotation', () => {
  it('scopes the delete to the owner concierge', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'a1' })
    const ok = await deleteAnnotation('a1', 'chelsea-1')
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(sql).toContain('WHERE id = $1 AND concierge_id = $2')
    expect(params).toEqual(['a1', 'chelsea-1'])
    expect(ok).toBe(true)
  })

  it('returns false when no row matched (wrong concierge or missing)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    expect(await deleteAnnotation('a1', 'someone-else')).toBe(false)
  })
})

describe('logConciergeAction', () => {
  it('inserts with a JSON-stringified payload + casts to jsonb', async () => {
    mockQuery.mockResolvedValueOnce([])
    await logConciergeAction({
      concierge_id: 'chelsea-1',
      action:       'annotation_upserted',
      subject_type: 'annotation',
      subject_id:   'a1',
      payload:      { vouch_strength: 'know' },
    })
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('INSERT INTO concierge_audit_log')
    expect(sql).toContain('$5::jsonb')
    expect(params).toEqual([
      'chelsea-1', 'annotation_upserted', 'annotation', 'a1',
      JSON.stringify({ vouch_strength: 'know' }),
    ])
  })

  it('serializes an empty payload when none is provided', async () => {
    mockQuery.mockResolvedValueOnce([])
    await logConciergeAction({ concierge_id: 'chelsea-1', action: 'something' })
    expect(mockQuery.mock.calls[0][1][4]).toBe('{}')
  })
})

describe('recentConciergeActions', () => {
  it('orders by created_at DESC with default limit 50', async () => {
    mockQuery.mockResolvedValueOnce([])
    await recentConciergeActions('chelsea-1')
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('ORDER BY created_at DESC')
    expect(params).toEqual(['chelsea-1', 50])
  })
})

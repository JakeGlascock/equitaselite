import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}))

import { fetchSurfaceItems } from '@/lib/rss-surface'

beforeEach(() => { mockQuery.mockReset() })

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id:           'item-1',
  title:        'Sample item',
  summary:      'A short summary',
  link:         'https://example.com/post',
  source_label: 'NY Times',
  sector_tag:   'Cross-sector',
  min_tier:     'access' as const,
  published_at: new Date('2026-05-10T12:00:00Z'),
  fetched_at:   new Date('2026-05-15T01:00:00Z'),
  ...overrides,
})

describe('fetchSurfaceItems', () => {
  it('maps DB rows into FeedItem shape (source_label → source, sector_tag → sector, min_tier → minTier)', async () => {
    mockQuery.mockResolvedValueOnce([dbRow()])
    const items = await fetchSurfaceItems('insights')
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      id:          'item-1',
      title:       'Sample item',
      summary:     'A short summary',
      link:        'https://example.com/post',
      source:      'NY Times',
      sector:      'Cross-sector',
      minTier:     'access',
      publishedAt: '2026-05-10T12:00:00.000Z',
    })
  })

  it('passes the surface as $1 and limit (default 50) as $2', async () => {
    mockQuery.mockResolvedValueOnce([])
    await fetchSurfaceItems('reports')
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual(['reports', 50])
  })

  it('honors a custom limit argument', async () => {
    mockQuery.mockResolvedValueOnce([])
    await fetchSurfaceItems('network', 12)
    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual(['network', 12])
  })

  it('filters in SQL on f.active = TRUE so disabled feeds vanish', async () => {
    mockQuery.mockResolvedValueOnce([])
    await fetchSurfaceItems('insights')
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain('f.active = TRUE')
  })

  it('falls back to fetched_at when published_at is NULL', async () => {
    mockQuery.mockResolvedValueOnce([dbRow({ published_at: null })])
    const items = await fetchSurfaceItems('insights')
    expect(items[0].publishedAt).toBe('2026-05-15T01:00:00.000Z')
  })

  it('coerces null summary to empty string', async () => {
    mockQuery.mockResolvedValueOnce([dbRow({ summary: null })])
    const items = await fetchSurfaceItems('insights')
    expect(items[0].summary).toBe('')
  })

  it('handles ISO-string timestamps (pg may return either form)', async () => {
    mockQuery.mockResolvedValueOnce([dbRow({
      published_at: '2026-05-10T12:00:00Z',
      fetched_at:   '2026-05-15T01:00:00Z',
    })])
    const items = await fetchSurfaceItems('insights')
    expect(items[0].publishedAt).toBe('2026-05-10T12:00:00Z')
  })

  it('returns [] when the query throws (rss tables not yet migrated)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "rss_items" does not exist'))
    const items = await fetchSurfaceItems('insights')
    expect(items).toEqual([])
  })

  it('returns [] when the query returns an empty result set', async () => {
    mockQuery.mockResolvedValueOnce([])
    const items = await fetchSurfaceItems('insights')
    expect(items).toEqual([])
  })

  it('orders by COALESCE(published_at, fetched_at) DESC so most-recent first', async () => {
    mockQuery.mockResolvedValueOnce([])
    await fetchSurfaceItems('insights')
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain('COALESCE(i.published_at, i.fetched_at) DESC')
  })
})

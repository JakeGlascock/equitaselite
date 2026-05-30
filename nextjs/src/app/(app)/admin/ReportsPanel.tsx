'use client'

import { useState, useEffect, useCallback } from 'react'

interface ReportRow {
  id:           string
  slug:         string
  title:        string
  summary:      string
  sector_tag:   string
  min_tier:     'access' | 'select' | 'sovereign'
  published_at: string | null
  created_at:   string
  updated_at:   string
}

const SECTORS = ['FinTech', 'AI / ML', 'SaaS', 'Healthcare', 'Life Sciences', 'Clean Energy', 'Defense Tech', 'Deep Tech', 'Consumer', 'Real Estate', 'Cross-sector']

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReportsPanel() {
  const [reports, setReports]   = useState<ReportRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [slug, setSlug]         = useState('')
  const [title, setTitle]       = useState('')
  const [summary, setSummary]   = useState('')
  const [sector, setSector]     = useState(SECTORS[0])
  const [minTier, setMinTier]   = useState<'access' | 'select' | 'sovereign'>('select')
  const [body, setBody]         = useState('')
  const [publishNow, setPublishNow] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reports')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setReports(data.reports ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/reports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          slug:        slug.trim(),
          title:       title.trim(),
          summary:     summary.trim(),
          sector_tag:  sector,
          body,
          min_tier:    minTier,
          publish_now: publishNow,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setSlug(''); setTitle(''); setSummary(''); setBody(''); setPublishNow(false)
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function togglePublish(report: ReportRow) {
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ published: !report.published_at }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function remove(report: ReportRow) {
    if (!confirm(`Delete "${report.title}"? This can't be undone.`)) return
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  function slugifyTitle() {
    if (!title.trim() || slug.trim()) return
    setSlug(title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80))
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Title</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={slugifyTitle}
              required minLength={3} maxLength={200}
              className="input-field mt-1.5"
              placeholder="e.g. The State of Family Office Allocations to AI"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Slug (URL path)</span>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              required pattern="[a-z0-9-]{3,80}"
              className="input-field mt-1.5 font-mono text-xs"
              placeholder="state-of-fo-allocations-to-ai"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Sector</span>
            <select value={sector} onChange={e => setSector(e.target.value)} className="input-field mt-1.5">
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Summary (shows on list view)</span>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              required minLength={10} maxLength={500}
              rows={2}
              className="input-field mt-1.5 resize-none"
              placeholder="One- or two-sentence teaser. Shows on the /reports list before the body opens."
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Minimum tier</span>
            <select value={minTier} onChange={e => setMinTier(e.target.value as typeof minTier)} className="input-field mt-1.5">
              <option value="access">Access (everyone with an account)</option>
              <option value="select">Select</option>
              <option value="sovereign">Sovereign</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Publish on save?</span>
            <div className="mt-1.5 flex items-center gap-2 h-[42px]">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={e => setPublishNow(e.target.checked)}
                className="w-4 h-4 accent-ee-gold"
              />
              <span className="text-xs text-ee-muted">{publishNow ? 'Will be live immediately' : 'Save as draft'}</span>
            </div>
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Body (Markdown)</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required minLength={20} maxLength={50000}
              rows={10}
              className="input-field mt-1.5 resize-y font-mono text-xs"
              placeholder={`## Headline\n\nOpening paragraph...\n\n### Section\n\nMore content. **Bold** and *italic* and [links](https://example.com) all work.`}
            />
          </label>
        </div>

        <button type="submit" className="btn-gold text-xs">
          {publishNow ? 'Create &amp; publish' : 'Save draft'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      <div>
        <p className="text-[10px] font-data uppercase tracking-widest text-ee-muted mb-2">
          Reports {loading && '· loading…'}
        </p>
        {reports.length === 0 ? (
          <p className="text-xs text-ee-muted">No reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ee-muted text-left">
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Title</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Sector</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Tier</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Published</th>
                  <th className="py-1.5 font-data uppercase tracking-widest text-[10px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ee-border/40">
                {reports.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <p className="text-ee-primary">{r.title}</p>
                      <p className="text-[10px] text-ee-muted font-mono">{r.slug}</p>
                    </td>
                    <td className="py-2 pr-3 text-ee-muted">{r.sector_tag}</td>
                    <td className="py-2 pr-3 text-ee-muted capitalize">{r.min_tier}</td>
                    <td className={`py-2 pr-3 ${r.published_at ? 'text-ee-emerald' : 'text-ee-muted'}`}>
                      {r.published_at ? fmtDate(r.published_at) : 'Draft'}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => togglePublish(r)}
                          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold"
                        >
                          {r.published_at ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

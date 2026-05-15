'use client'

import { useState, useEffect, useCallback } from 'react'

interface SovereignProfile {
  id:        string
  full_name: string
  firm_name: string
}

interface BriefingRow {
  id:                string
  recipient_user_id: string
  recipient_name:    string | null
  title:             string
  summary:           string
  published_at:      string | null
  created_at:        string
  updated_at:        string
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Bespoke portfolio intelligence — one briefing per row, addressed to
// a specific Sovereign recipient. Mirrors ReportsPanel structurally
// but adds a recipient selector and drops the slug/sector/min_tier
// fields (briefings are recipient-scoped by design).
export default function PortfolioReportsPanel({ sovereigns }: { sovereigns: SovereignProfile[] }) {
  const [briefings, setBriefings] = useState<BriefingRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const [recipientId, setRecipientId] = useState(sovereigns[0]?.id ?? '')
  const [title, setTitle]             = useState('')
  const [summary, setSummary]         = useState('')
  const [body, setBody]               = useState('')
  const [publishNow, setPublishNow]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/portfolio-reports')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setBriefings(data.briefings ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!recipientId || !title.trim()) return
    try {
      const res = await fetch('/api/admin/portfolio-reports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recipient_user_id: recipientId,
          title:             title.trim(),
          summary:           summary.trim(),
          body,
          publish_now:       publishNow,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setTitle(''); setSummary(''); setBody(''); setPublishNow(false)
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function togglePublish(b: BriefingRow) {
    try {
      const res = await fetch(`/api/admin/portfolio-reports/${b.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ published: !b.published_at }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed')
      }
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function remove(b: BriefingRow) {
    if (!confirm(`Delete "${b.title}"? This can't be undone.`)) return
    try {
      const res = await fetch(`/api/admin/portfolio-reports/${b.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (sovereigns.length === 0) {
    return (
      <p className="text-xs text-ee-muted">
        No Sovereign-tier members yet. Bespoke briefings are tier-gated to Sovereign — promote a member from the MembersTable first.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Recipient (Sovereign-tier only)</span>
            <select
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
              required
              className="input-field mt-1.5"
            >
              {sovereigns.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} — {p.firm_name}</option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Title</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required minLength={3} maxLength={200}
              className="input-field mt-1.5"
              placeholder="e.g. Week of May 12 — AI infra mandate update"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Summary</span>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              required minLength={10} maxLength={500}
              rows={2}
              className="input-field mt-1.5 resize-none"
              placeholder="One-line takeaway shown on the briefing list before they click in."
            />
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
              <span className="text-xs text-ee-muted">{publishNow ? 'Will be live for the recipient immediately' : 'Save as draft'}</span>
            </div>
          </label>

          <div />

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Body (Markdown)</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required minLength={20} maxLength={50000}
              rows={10}
              className="input-field mt-1.5 resize-y font-mono text-xs"
              placeholder={`## Headline\n\nThe week's most material development for your mandate...\n\n### What changed\n\nDetails.\n\n### What we recommend\n\nDetails.`}
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
          Briefings {loading && '· loading…'}
        </p>
        {briefings.length === 0 ? (
          <p className="text-xs text-ee-muted">No briefings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ee-muted text-left">
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Title</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Recipient</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Published</th>
                  <th className="py-1.5 font-data uppercase tracking-widest text-[10px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ee-border/40">
                {briefings.map(b => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 text-ee-primary max-w-[20rem] truncate">{b.title}</td>
                    <td className="py-2 pr-3 text-ee-muted">{b.recipient_name ?? '—'}</td>
                    <td className={`py-2 pr-3 ${b.published_at ? 'text-ee-emerald' : 'text-ee-muted'}`}>
                      {b.published_at ? fmtDate(b.published_at) : 'Draft'}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => togglePublish(b)}
                          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold"
                        >
                          {b.published_at ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(b)}
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

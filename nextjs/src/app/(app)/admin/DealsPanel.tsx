'use client'

import { useState, useEffect, useCallback } from 'react'

interface Deal {
  id:              string
  title:           string
  description:     string
  sectors:         string[]
  stages:          string[]
  check_size_min:  number | null
  check_size_max:  number | null
  geography:       string | null
  status:          'open' | 'closed' | 'filled'
  created_at:      string
}

interface SovereignProfile { id: string; full_name: string; firm_name: string }

const SECTORS = ['FinTech', 'AI / ML', 'SaaS', 'Healthcare', 'Life Sciences', 'Clean Energy', 'Defense Tech', 'Deep Tech', 'Consumer', 'Real Estate', 'Crypto']
const STAGES  = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth', 'Pre-IPO']

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function DealsPanel({ sovereigns }: { sovereigns: SovereignProfile[] }) {
  const [deals, setDeals]     = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [sectors, setSectors]     = useState<string[]>([])
  const [stages, setStages]       = useState<string[]>([])
  const [checkMin, setCheckMin]   = useState('')
  const [checkMax, setCheckMax]   = useState('')
  const [geography, setGeography] = useState('')
  // P3 — concierge note on the deal. Optional; shows only to invitees
  // on the member /deals page, attributed to the authoring concierge.
  const [conciergeNote, setNote]  = useState('')

  // After create: open the invite picker for the new deal.
  const [invitingDeal, setInvitingDeal] = useState<Deal | null>(null)
  const [selectedSovereigns, setSelectedSovereigns] = useState<Set<string>>(new Set())
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/deals')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setDeals(data.deals ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function toggleSet<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    setter(next)
  }
  function toggleList<T>(list: T[], value: T, setter: (l: T[]) => void) {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/deals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:          title.trim(),
          description:    description.trim(),
          sectors,
          stages,
          check_size_min: checkMin ? Number(checkMin) : null,
          check_size_max: checkMax ? Number(checkMax) : null,
          geography:      geography.trim() || null,
          concierge_note: conciergeNote.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setTitle(''); setDesc(''); setSectors([]); setStages([])
      setCheckMin(''); setCheckMax(''); setGeography(''); setNote('')
      setInvitingDeal(data.deal)
      setSelectedSovereigns(new Set())
      setInviteResult('')
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function sendInvitations() {
    if (!invitingDeal || selectedSovereigns.size === 0) return
    setInviteBusy(true); setInviteResult('')
    try {
      const res = await fetch(`/api/admin/deals/${invitingDeal.id}/invitations`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_ids: [...selectedSovereigns] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      setInviteResult(`Invited ${data.created} Sovereign${data.created === 1 ? '' : 's'}${data.skipped > 0 ? ` · ${data.skipped} already invited or ineligible` : ''}.`)
    } catch (err: unknown) {
      setInviteResult(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviteBusy(false)
    }
  }

  async function setStatus(deal: Deal, status: Deal['status']) {
    try {
      const res = await fetch(`/api/admin/deals/${deal.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function remove(deal: Deal) {
    if (!confirm(`Delete "${deal.title}"? Invitations will be removed too.`)) return
    try {
      const res = await fetch(`/api/admin/deals/${deal.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      if (invitingDeal?.id === deal.id) setInvitingDeal(null)
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
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
              required minLength={3} maxLength={200}
              className="input-field mt-1.5"
              placeholder="e.g. Series B in vertical-AI underwriting platform"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Description (Markdown)</span>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              required minLength={20} maxLength={50000}
              rows={6}
              className="input-field mt-1.5 resize-y font-mono text-xs"
              placeholder="Thesis, traction, terms, allocation available. Stays inside Equitas Elite — only invited Sovereigns will see it."
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Check size — min (USD)</span>
            <input
              type="number" min={0} step={1000}
              value={checkMin}
              onChange={e => setCheckMin(e.target.value)}
              className="input-field mt-1.5"
              placeholder="250000"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Check size — max (USD)</span>
            <input
              type="number" min={0} step={1000}
              value={checkMax}
              onChange={e => setCheckMax(e.target.value)}
              className="input-field mt-1.5"
              placeholder="2000000"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Geography</span>
            <input
              value={geography}
              onChange={e => setGeography(e.target.value)}
              maxLength={120}
              className="input-field mt-1.5"
              placeholder="US, EU, Global, etc."
            />
          </label>

          <div className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Sectors</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SECTORS.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => toggleList(sectors, s, setSectors)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${sectors.includes(s) ? 'border-ee-gold text-ee-gold bg-ee-gold/10' : 'border-ee-border text-ee-muted hover:text-ee-primary'}`}
                >{s}</button>
              ))}
            </div>
          </div>

          <div className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Stages</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STAGES.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => toggleList(stages, s, setStages)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${stages.includes(s) ? 'border-ee-gold text-ee-gold bg-ee-gold/10' : 'border-ee-border text-ee-muted hover:text-ee-primary'}`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* P3 — concierge note. Optional. Only invited Sovereigns see
              it; rendered on /deals as a visually-distinct gold block
              attributed to the authoring concierge so the two-trust-
              layers separation is preserved. */}
          <label className="block md:col-span-2">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-gold">
              Concierge note (optional)
            </span>
            <textarea
              value={conciergeNote}
              onChange={e => setNote(e.target.value)}
              maxLength={4000}
              rows={3}
              className="input-field mt-1.5 resize-y font-mono text-xs"
              placeholder="Your read on this deal — visible only to invitees, attributed to you. e.g. 'Worked directly with the lead at his last fund; their underwriting on this thesis is strong.'"
            />
          </label>
        </div>

        <button type="submit" className="btn-gold text-xs">Create deal &amp; pick invitees</button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      {invitingDeal && (
        <div className="rounded-lg border border-ee-gold/40 bg-ee-gold/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-data uppercase tracking-widest text-ee-gold">Invite Sovereigns</p>
              <p className="text-sm text-ee-primary mt-1">{invitingDeal.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setInvitingDeal(null)}
              className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary"
            >Close</button>
          </div>
          {sovereigns.length === 0 ? (
            <p className="text-xs text-ee-muted">No Sovereign-tier members yet to invite.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSovereigns(new Set(sovereigns.map(s => s.id)))}
                  className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold"
                >Select all</button>
                <button
                  type="button"
                  onClick={() => setSelectedSovereigns(new Set())}
                  className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold"
                >Clear</button>
                <span className="text-[10px] text-ee-muted">{selectedSovereigns.size} selected</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {sovereigns.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 rounded border border-ee-border/60 cursor-pointer hover:border-ee-gold/40">
                    <input
                      type="checkbox"
                      checked={selectedSovereigns.has(s.id)}
                      onChange={() => toggleSet(selectedSovereigns, s.id, setSelectedSovereigns)}
                      className="w-4 h-4 accent-ee-gold"
                    />
                    <div>
                      <p className="text-xs text-ee-primary">{s.full_name}</p>
                      <p className="text-[10px] text-ee-muted">{s.firm_name}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendInvitations}
                  disabled={inviteBusy || selectedSovereigns.size === 0}
                  className="btn-gold text-xs disabled:opacity-50"
                >{inviteBusy ? 'Sending…' : `Send ${selectedSovereigns.size || ''} invitation${selectedSovereigns.size === 1 ? '' : 's'}`}</button>
                {inviteResult && <p className="text-xs text-ee-muted">{inviteResult}</p>}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <p className="text-[10px] font-data uppercase tracking-widest text-ee-muted mb-2">
          Deals {loading && '· loading…'}
        </p>
        {deals.length === 0 ? (
          <p className="text-xs text-ee-muted">No deals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ee-muted text-left">
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Title</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Check</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Status</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Created</th>
                  <th className="py-1.5 font-data uppercase tracking-widest text-[10px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ee-border/40">
                {deals.map(d => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3">
                      <p className="text-ee-primary">{d.title}</p>
                      <p className="text-[10px] text-ee-muted">
                        {[...d.sectors, ...d.stages].slice(0, 4).join(' · ')}
                        {d.geography ? ` · ${d.geography}` : ''}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-ee-muted">
                      {fmtMoney(d.check_size_min)} – {fmtMoney(d.check_size_max)}
                    </td>
                    <td className={`py-2 pr-3 capitalize ${d.status === 'open' ? 'text-ee-emerald' : 'text-ee-muted'}`}>
                      {d.status}
                    </td>
                    <td className="py-2 pr-3 text-ee-muted">{fmtDate(d.created_at)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => { setInvitingDeal(d); setSelectedSovereigns(new Set()); setInviteResult('') }}
                          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold"
                        >Invite</button>
                        {d.status === 'open' ? (
                          <button
                            type="button"
                            onClick={() => setStatus(d, 'closed')}
                            className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary"
                          >Close</button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setStatus(d, 'open')}
                            className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-emerald"
                          >Reopen</button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(d)}
                          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-red-400"
                        >Delete</button>
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

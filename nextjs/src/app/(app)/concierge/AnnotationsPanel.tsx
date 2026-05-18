'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type VouchStrength = 'know' | 'worked_with' | 'would_invest'

export interface AnnotationRow {
  id:              string
  counterparty_id: string
  note:            string
  vouch_strength:  VouchStrength | null
  visibility:      'private' | 'member_visible' | 'public'
  updated_at:      string
}

export interface CounterpartyOption {
  id:        string
  full_name: string
  firm_name: string
  role:      'angel' | 'family_office'
}

const VOUCH_LABELS: Record<VouchStrength, string> = {
  know:          'Know',
  worked_with:   'Worked with',
  would_invest:  'Would invest',
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnnotationsPanel({
  initialAnnotations, counterparties,
}: {
  initialAnnotations: AnnotationRow[]
  counterparties:     CounterpartyOption[]
}) {
  const router = useRouter()
  const [annotations, setAnnotations] = useState<AnnotationRow[]>(initialAnnotations)
  const [search, setSearch]           = useState('')
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [note, setNote]               = useState('')
  const [vouch, setVouch]             = useState<VouchStrength | ''>('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Annotated counterparty IDs → quick lookup for the picker hint.
  const annotatedSet = useMemo(() => new Set(annotations.map(a => a.counterparty_id)), [annotations])

  // Filter the counterparty list by the search query. Capped at 12 to
  // keep the dropdown manageable. Chelsea types a few characters and
  // narrows; the existing-annotation indicator helps her notice repeats.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return counterparties.slice(0, 12)
    return counterparties.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.firm_name.toLowerCase().includes(q)
    ).slice(0, 12)
  }, [counterparties, search])

  // Counterparty profile lookup for displaying annotations by name.
  const cpById = useMemo(
    () => new Map(counterparties.map(c => [c.id, c])),
    [counterparties],
  )

  const selected = selectedId ? cpById.get(selectedId) ?? null : null
  const existing = selectedId ? annotations.find(a => a.counterparty_id === selectedId) ?? null : null

  function pickCounterparty(id: string) {
    setSelectedId(id)
    setSearch('')
    const existingForId = annotations.find(a => a.counterparty_id === id)
    if (existingForId) {
      setNote(existingForId.note)
      setVouch(existingForId.vouch_strength ?? '')
    } else {
      setNote('')
      setVouch('')
    }
    setError('')
  }

  function clearForm() {
    setSelectedId(null)
    setNote('')
    setVouch('')
    setError('')
  }

  async function save() {
    if (!selectedId || !note.trim()) {
      setError('Pick a counterparty and write a note.')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/concierge/annotations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          counterparty_id: selectedId,
          note:            note.trim(),
          vouch_strength:  vouch || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      // Optimistically merge into the local list. router.refresh() pulls
      // the server-side source-of-truth on next request.
      setAnnotations(prev => {
        const others = prev.filter(a => a.counterparty_id !== selectedId)
        return [data as AnnotationRow, ...others]
      })
      clearForm()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/concierge/annotations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      setAnnotations(prev => prev.filter(a => a.id !== id))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Layer 2 · Private</p>
        <h2 className="font-display text-2xl text-ee-gold mt-1">Counterparty annotations</h2>
        <p className="text-ee-muted text-sm mt-1 leading-relaxed">
          Notes on counterparties you know or have worked with. These stay private —
          only you and admins see them. They drive your downstream actions (warm
          intros, prioritization) without surfacing to members as a public signal.
        </p>
      </div>

      {/* Form */}
      <div className="glass-panel p-5 space-y-4">
        <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
          {existing ? 'Edit annotation' : 'New annotation'}
        </p>

        {!selectedId ? (
          <div className="space-y-2">
            <label className="block text-xs text-ee-muted">Pick a counterparty</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or firm…"
              className="input-field"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCounterparty(c.id)}
                  className="text-left text-xs px-3 py-2 rounded-md border border-ee-border hover:border-ee-gold/40 hover:bg-white/5 transition-colors"
                >
                  <p className="text-ee-primary truncate">{c.full_name}</p>
                  <p className="text-ee-muted truncate text-[10px]">
                    {c.firm_name} · {c.role === 'angel' ? 'Angel' : 'FO'}
                    {annotatedSet.has(c.id) && (
                      <span className="ml-2 font-data uppercase tracking-widest text-ee-gold/70">noted</span>
                    )}
                  </p>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-ee-muted col-span-2">No matches.</p>
              )}
            </div>
          </div>
        ) : selected && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ee-primary truncate">{selected.full_name}</p>
                <p className="text-[11px] text-ee-muted truncate">
                  {selected.firm_name} · {selected.role === 'angel' ? 'Angel' : 'Family Office'}
                </p>
              </div>
              <button
                type="button"
                onClick={clearForm}
                className="text-xs text-ee-muted hover:text-ee-primary font-data uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-ee-muted">Note (private)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="What you know about them — context, history, anything that informs how you'd act on their behalf."
                className="input-field text-sm resize-none leading-relaxed"
              />
              <p className="text-[10px] text-ee-muted/80">{note.length}/4000</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-ee-muted">Vouch strength (optional)</label>
              <select
                value={vouch}
                onChange={e => setVouch((e.target.value as VouchStrength) || '')}
                className="input-field"
              >
                <option value="">— No vouch —</option>
                <option value="know">Know them</option>
                <option value="worked_with">Worked with them</option>
                <option value="would_invest">Would invest with them myself</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {error && <span className="text-xs text-red-400">{error}</span>}
              <div className="flex-1" />
              <button
                type="button"
                onClick={save}
                disabled={saving || !note.trim()}
                className="btn-gold text-xs whitespace-nowrap disabled:opacity-40"
              >
                {saving ? 'Saving…' : existing ? 'Update' : 'Save annotation'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
          {annotations.length} annotation{annotations.length === 1 ? '' : 's'}
        </p>
        {annotations.length === 0 ? (
          <p className="text-xs text-ee-muted">No annotations yet. Pick a counterparty above to start.</p>
        ) : (
          <ul className="space-y-2">
            {annotations.map(a => {
              const cp = cpById.get(a.counterparty_id)
              return (
                <li key={a.id} className="glass-panel p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-ee-primary truncate">
                        {cp?.full_name ?? <span className="italic text-ee-muted">[deleted member]</span>}
                      </p>
                      {cp && (
                        <p className="text-[11px] text-ee-muted truncate">
                          {cp.firm_name} · {cp.role === 'angel' ? 'Angel' : 'Family Office'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.vouch_strength && (
                        <span className="font-data text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-ee-gold/40 bg-ee-gold/10 text-ee-gold">
                          {VOUCH_LABELS[a.vouch_strength]}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => cp && pickCounterparty(cp.id)}
                        className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm('Delete this annotation?')) remove(a.id) }}
                        className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-ee-muted leading-relaxed whitespace-pre-wrap">{a.note}</p>
                  <p className="text-[10px] text-ee-muted/70 font-data">Updated {fmtDate(a.updated_at)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

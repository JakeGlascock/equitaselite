'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type EventType = 'Summit' | 'Roundtable' | 'Webinar' | 'Showcase'
type Tier      = 'access' | 'select' | 'sovereign'

interface ExistingEvent {
  id:          string
  title:       string
  type:        EventType
  date:        string  // ISO
  duration:    string
  location:    string
  capacity:    number
  registered:  number
  min_tier:    Tier
}

const TYPES:     EventType[] = ['Summit', 'Roundtable', 'Webinar', 'Showcase']
const TIERS:     Tier[]      = ['access', 'select', 'sovereign']
const TIER_LABEL: Record<Tier, string> = { access: 'Access+', select: 'Select+', sovereign: 'Sovereign only' }

function defaultIsoDate(): string {
  // 7 days from now, 6pm UTC, formatted for <input type="datetime-local">
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  d.setUTCHours(18, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}

export default function CreateEventForm({ existing }: { existing: ExistingEvent[] }) {
  const router = useRouter()
  const [title,      setTitle]      = useState('')
  const [description, setDescription] = useState('')
  const [type,       setType]       = useState<EventType>('Roundtable')
  const [date,       setDate]       = useState(defaultIsoDate())
  const [duration,   setDuration]   = useState('90 min')
  const [location,   setLocation]   = useState('Virtual')
  const [capacity,   setCapacity]   = useState(20)
  const [minTier,    setMinTier]    = useState<Tier>('select')
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, type,
          // <input type="datetime-local"> returns "YYYY-MM-DDTHH:MM" — append :00Z for ISO
          date: `${date}:00Z`,
          duration, location, capacity, min_tier: minTier,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      // Reset and refresh
      setTitle(''); setDescription(''); setDuration('90 min'); setLocation('Virtual')
      setCapacity(20); setType('Roundtable'); setMinTier('select')
      setDate(defaultIsoDate())
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? RSVPs will be lost.`)) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Something went wrong. Please try again.')
      router.refresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} maxLength={200} className="input-field" placeholder="Q3 FinTech Roundtable" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={2} maxLength={2000} rows={3} className="input-field" placeholder="Closed-door talks on…" />
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Type</label>
            <select value={type} onChange={e => setType(e.target.value as EventType)} className="input-field">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Date / time</label>
            <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Duration</label>
            <input value={duration} onChange={e => setDuration(e.target.value)} required className="input-field" placeholder="90 min" />
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} required className="input-field" placeholder="Virtual / SF / Aspen" />
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Capacity</label>
            <input type="number" min={1} max={5000} value={capacity} onChange={e => setCapacity(Number(e.target.value))} required className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-ee-muted mb-1 font-data uppercase tracking-wider">Minimum tier</label>
            <select value={minTier} onChange={e => setMinTier(e.target.value as Tier)} className="input-field">
              {TIERS.map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="btn-gold text-sm disabled:opacity-50">
            {busy ? 'Creating…' : 'Create event'}
          </button>
        </div>
      </form>

      {existing.length > 0 && (
        <div className="pt-4 border-t border-ee-border">
          <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">Existing events</p>
          <ul className="space-y-2">
            {existing.map(ev => (
              <li key={ev.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="text-ee-primary truncate">{ev.title}</p>
                  <p className="text-ee-muted">
                    {fmtDate(ev.date)} · {ev.type} · {ev.registered}/{ev.capacity} · {TIER_LABEL[ev.min_tier]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(ev.id, ev.title)}
                  className="text-red-400/80 hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/10"
                  title="Delete event"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'

// Multi-role identity panel for /profile (migration 034).
// User-controlled flags are Angel + Family Office. Concierge is shown
// as a read-only badge if granted (admin-controlled, no self-toggle).
//
// A profile must keep at least one of Angel / Family Office / Concierge.
// If the user tries to clear both investor flags AND isn't a concierge,
// the UI refuses to PATCH and surfaces an inline error.

export default function IdentityPanel({
  initialIsAngel,
  initialIsFamilyOffice,
  isConcierge,
}: {
  initialIsAngel:        boolean
  initialIsFamilyOffice: boolean
  isConcierge:           boolean
}) {
  const [isAngel,        setIsAngel]        = useState(initialIsAngel)
  const [isFamilyOffice, setIsFamilyOffice] = useState(initialIsFamilyOffice)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function flip(field: 'is_angel' | 'is_family_office', next: boolean) {
    // Prevent clearing the last investor role on a non-concierge.
    const wouldBeAngel        = field === 'is_angel'         ? next : isAngel
    const wouldBeFamilyOffice = field === 'is_family_office' ? next : isFamilyOffice
    if (!wouldBeAngel && !wouldBeFamilyOffice && !isConcierge) {
      setError('You must hold at least one role. Toggle another role on first.')
      return
    }

    setBusy(true); setError('')
    try {
      const res = await fetch('/api/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (field === 'is_angel')        setIsAngel(next)
      if (field === 'is_family_office') setIsFamilyOffice(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <p className="font-display text-base text-ee-primary">Identity</p>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">
          Hold any combination of roles. Each investor-side role can have its own mandate
          (coming in the next phase). Concierge is staff-only — granted by an EE admin.
        </p>
      </div>

      <div className="space-y-3">
        <RoleRow
          label="Angel investor"
          description="Individual investor making direct checks into companies."
          on={isAngel}
          busy={busy}
          onChange={next => flip('is_angel', next)}
        />
        <RoleRow
          label="Family Office"
          description="Institutional steward of family or principal capital."
          on={isFamilyOffice}
          busy={busy}
          onChange={next => flip('is_family_office', next)}
        />
        {isConcierge && (
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-sm text-ee-primary flex items-center gap-2">
                Concierge
                <span className="text-[10px] font-data uppercase tracking-wider px-1.5 py-px rounded-sm border border-ee-gold/40 bg-ee-gold/[0.08] text-ee-gold">
                  EE staff
                </span>
              </p>
              <p className="text-[11px] text-ee-muted mt-0.5">
                Granted by an admin. Manage members on behalf of EE.
              </p>
            </div>
            <span className="text-[11px] text-ee-muted italic shrink-0">Admin-controlled</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function RoleRow({
  label, description, on, busy, onChange,
}: {
  label:       string
  description: string
  on:          boolean
  busy:        boolean
  onChange:    (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ee-primary">{label}</p>
        <p className="text-[11px] text-ee-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        disabled={busy}
        aria-pressed={on}
        aria-label={`${on ? 'Disable' : 'Enable'} ${label}`}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 shrink-0 ${
          on ? 'bg-ee-emerald' : 'bg-white/10 border border-ee-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
            on ? 'translate-x-6 bg-ee-bg' : 'translate-x-0.5 bg-ee-muted'
          }`}
        />
      </button>
    </div>
  )
}

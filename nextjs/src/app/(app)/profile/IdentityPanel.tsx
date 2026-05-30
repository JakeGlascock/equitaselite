'use client'

import { useState } from 'react'

// Multi-role identity panel for /profile (migrations 034 + 035).
//
// Five investor-side roles the user can self-toggle:
//   Angel, Family Office, Next Gen, Family Foundation, DAF
//
// Concierge is staff-only and surfaces as a read-only badge if granted.
//
// A profile must keep at least one role (any of the five investor-side
// flags OR is_concierge). The UI refuses to clear the last investor
// role on a non-concierge.

type InvestorRoleField = 'is_angel' | 'is_family_office' | 'is_next_gen' | 'is_family_foundation' | 'is_daf'

const ROW_CONFIG: { field: InvestorRoleField; label: string; description: string }[] = [
  { field: 'is_angel',             label: 'Angel investor',
    description: 'Individual investor making direct checks into companies.' },
  { field: 'is_family_office',     label: 'Family Office',
    description: 'Institutional steward of family or principal capital.' },
  { field: 'is_next_gen',          label: 'Next Gen',
    description: 'Next-generation member of a family wealth lineage. Often paired with Angel or Family Office.' },
  { field: 'is_family_foundation', label: 'Family Foundation',
    description: '501(c)(3) family foundation. Charitable entity with its own investment mandate.' },
  { field: 'is_daf',               label: 'Donor-Advised Fund (DAF)',
    description: 'Sponsor-held charitable account. Grant-funded investment cadence, often impact-themed.' },
]

export default function IdentityPanel({
  initialIsAngel,
  initialIsFamilyOffice,
  initialIsNextGen,
  initialIsFamilyFoundation,
  initialIsDaf,
  isConcierge,
}: {
  initialIsAngel:            boolean
  initialIsFamilyOffice:     boolean
  initialIsNextGen:          boolean
  initialIsFamilyFoundation: boolean
  initialIsDaf:              boolean
  isConcierge:               boolean
}) {
  const [flags, setFlags] = useState<Record<InvestorRoleField, boolean>>({
    is_angel:             initialIsAngel,
    is_family_office:     initialIsFamilyOffice,
    is_next_gen:          initialIsNextGen,
    is_family_foundation: initialIsFamilyFoundation,
    is_daf:               initialIsDaf,
  })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function flip(field: InvestorRoleField, next: boolean) {
    // Prevent clearing the last investor role on a non-concierge.
    const wouldBe = { ...flags, [field]: next }
    const anyInvestorRoleLeft = ROW_CONFIG.some(r => wouldBe[r.field])
    if (!anyInvestorRoleLeft && !isConcierge) {
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
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setFlags(wouldBe)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <p className="font-display text-base text-ee-primary">Identity</p>
        <p className="text-xs text-ee-muted mt-1 leading-relaxed">
          Hold any combination of roles. Each investor-side role has its own mandate —
          edit them via the role tabs below. Concierge is staff-only; granted by an EE admin.
        </p>
      </div>

      <div className="space-y-3">
        {ROW_CONFIG.map(row => (
          <RoleRow
            key={row.field}
            label={row.label}
            description={row.description}
            on={flags[row.field]}
            busy={busy}
            onChange={next => flip(row.field, next)}
          />
        ))}
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

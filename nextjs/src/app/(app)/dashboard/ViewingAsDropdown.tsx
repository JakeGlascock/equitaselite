'use client'

import { useRouter } from 'next/navigation'
import type { Role } from '@/lib/role-compat'

// Dropdown form of the dashboard role-context selector. Replaces the
// original Angel | Family Office pill toggle once migration 035 adds
// three more role types — five pills don't fit cleanly on mobile.
// Uses a native <select> so accessibility + mobile UX are free.

export default function ViewingAsDropdown({
  current, held, labels, ordered,
}: {
  current: Role | null
  held:    Role[]
  labels:  Record<Role, string>
  ordered: Role[]
}) {
  const router = useRouter()

  // Surface roles in the canonical INVESTOR_ROLES order, filtered to
  // what the viewer actually holds.
  const options = ordered.filter(r => held.includes(r))

  return (
    <select
      value={current ?? ''}
      onChange={e => {
        const next = e.target.value
        router.replace(next ? `/dashboard?role=${next}` : '/dashboard', { scroll: false })
      }}
      // Asymmetric padding: 12px left, 28px right. Native <select>
      // renders the arrow inside the right padding area, and on a
      // rounded-full shape the right curve eats some of that space —
      // pr-7 gives the arrow real breathing room from the edge.
      className="bg-ee-bg border border-ee-border rounded-full pl-3 pr-7 py-1.5 text-ee-primary text-xs font-semibold focus:outline-none focus:border-ee-gold/60 cursor-pointer"
      aria-label="Viewing as which role"
    >
      {options.map(r => (
        <option key={r} value={r}>{labels[r]}</option>
      ))}
    </select>
  )
}

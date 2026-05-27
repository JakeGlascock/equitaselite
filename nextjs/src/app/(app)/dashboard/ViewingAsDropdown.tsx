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

  // Native <select> renders its arrow pinned to the right edge by the
  // browser's UA stylesheet — padding only affects where the TEXT
  // sits. To position the arrow inside the rounded-full curve, we
  // disable the native arrow with appearance-none and paint a custom
  // SVG chevron as a background-image we can place anywhere.
  const chevronSvg =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%23bec6e0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")"
  return (
    <select
      value={current ?? ''}
      onChange={e => {
        const next = e.target.value
        router.replace(next ? `/dashboard?role=${next}` : '/dashboard', { scroll: false })
      }}
      // appearance-none kills the UA arrow; backgroundImage paints our
      // chevron positioned 14px from the right edge — clear of the
      // rounded-full curve, with the text room from pr-9.
      style={{
        backgroundImage:    chevronSvg,
        backgroundRepeat:   'no-repeat',
        backgroundPosition: 'right 14px center',
      }}
      className="appearance-none bg-ee-bg border border-ee-border rounded-full pl-4 pr-9 py-1.5 text-ee-primary text-xs font-semibold focus:outline-none focus:border-ee-gold/60 cursor-pointer"
      aria-label="Viewing as which role"
    >
      {options.map(r => (
        <option key={r} value={r}>{labels[r]}</option>
      ))}
    </select>
  )
}

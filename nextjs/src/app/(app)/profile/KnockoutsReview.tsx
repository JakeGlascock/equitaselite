import Link from 'next/link'
import type { KnockoutReason } from '@/types'

// Server component — renders nothing if the viewer has no knockouts set.
// Mounted on /profile above the mandate pillars form so users can see
// what they're hiding before scrolling into the editor.

export interface KnockoutSummaryItem {
  reason:   KnockoutReason
  label:    string
  detail:   string  // e.g. "Defense, Gambling" or "Sovereign or higher"
  blocked:  number  // count of candidates currently hidden by this filter
}

interface Props {
  totalCandidates: number  // candidates of opposite role, pre-filter
  totalBlocked:    number  // candidates the viewer's full knockout set hides
  items:           KnockoutSummaryItem[]
}

export default function KnockoutsReview({ totalCandidates, totalBlocked, items }: Props) {
  if (items.length === 0) return null

  const visible = Math.max(0, totalCandidates - totalBlocked)

  return (
    <section className="glass-panel p-6 md:p-7 space-y-4 border-ee-gold/30">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-gold uppercase">Hard filters active</p>
          <h2 className="font-display text-xl text-ee-primary mt-1">
            {totalBlocked} of {totalCandidates} counterparties hidden
          </h2>
          <p className="text-xs text-ee-muted mt-1 leading-relaxed">
            You currently see <strong className="text-ee-primary">{visible}</strong> on
            your dashboard. Clear a filter below by editing the matching pillar
            field — or scroll down to the mandate pillars form to adjust.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map(item => (
          <li
            key={item.reason}
            className="flex items-start gap-3 py-2 border-t border-ee-border/60 first:border-t-0"
          >
            <span className="material-symbols-outlined text-ee-gold/70 text-base mt-0.5">cancel</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ee-primary">
                {item.label}
                <span className="text-ee-muted font-normal"> — {item.detail}</span>
              </p>
              <p className="text-[11px] text-ee-muted mt-0.5">
                Hiding <strong className="text-ee-primary">{item.blocked}</strong>{' '}
                {item.blocked === 1 ? 'counterparty' : 'counterparties'} on your dashboard
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-ee-muted">
        Filters apply only to your view — counterparties don&apos;t know you&apos;ve
        filtered them.{' '}
        <Link href="/dashboard" className="text-ee-gold hover:underline">
          See your filtered match list →
        </Link>
      </p>
    </section>
  )
}

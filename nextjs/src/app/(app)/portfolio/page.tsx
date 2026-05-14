import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getMe } from '@/lib/matches'
import { getActingAsState } from '@/lib/acting-as'

interface DealRow {
  intro_id: string
  status: 'pending' | 'accepted' | 'declined'
  direction: 'outgoing' | 'incoming'
  created_at: string
  responded_at: string | null
  counterparty_name: string
  counterparty_firm: string
  counterparty_role: 'angel' | 'family_office'
  counterparty_check_min: number
  counterparty_check_max: number
}

function checkRange(min: number, max: number): string {
  const fmt = (v: number) => v >= 1 ? `$${v}M` : `$${v * 1000}K`
  return `${fmt(min)}–${fmt(max)}`
}

function relativeDate(s: string): string {
  const d = new Date(s)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return `${Math.floor(days/30)}mo ago`
}

export default async function PortfolioPage() {
  const state = await getActingAsState()
  if (!state) redirect('/signin')
  const userId = state.effectiveUserId

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const deals = await query<DealRow>(
    `SELECT
       i.id AS intro_id, i.status, i.created_at, i.responded_at,
       CASE WHEN i.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
       p.full_name      AS counterparty_name,
       p.firm_name      AS counterparty_firm,
       p.role           AS counterparty_role,
       p.check_size_min AS counterparty_check_min,
       p.check_size_max AS counterparty_check_max
     FROM introductions i
     JOIN profiles p ON p.id = CASE WHEN i.requester_id = $1 THEN i.recipient_id ELSE i.requester_id END
     WHERE i.requester_id = $1 OR i.recipient_id = $1
     ORDER BY i.created_at DESC`,
    [userId]
  )

  // Pipeline stages
  const introduced = deals.filter(d => d.status === 'pending')
  const active     = deals.filter(d => d.status === 'accepted')
  const closed     = deals.filter(d => d.status === 'declined')

  const totalAddressable = active.reduce((sum, d) =>
    sum + Number(d.counterparty_check_max), 0
  )

  function DealCard({ d, accentColor }: { d: DealRow; accentColor: string }) {
    return (
      <div className="bg-white/5 border border-ee-border rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ee-primary truncate">{d.counterparty_name}</p>
            <p className="text-xs text-ee-muted truncate">{d.counterparty_firm}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ee-muted font-data">
            {checkRange(Number(d.counterparty_check_min), Number(d.counterparty_check_max))}
          </span>
          <span className="text-ee-muted">{relativeDate(d.created_at)}</span>
        </div>
      </div>
    )
  }

  function Column({ title, count, color, items, emptyText }: {
    title: string; count: number; color: string; items: DealRow[]; emptyText: string
  }) {
    return (
      <div className="glass-panel p-4 space-y-3 min-h-[200px]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm text-ee-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {title}
          </h2>
          <span className="font-data text-xs text-ee-muted">{count}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-ee-muted pt-2">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.map(d => <DealCard key={d.intro_id} d={d} accentColor={color} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Holdings</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Portfolio</h1>
          <p className="text-ee-muted text-sm mt-1">
            Your deal pipeline — introductions tracked from first request through active relationship.
          </p>
        </div>

        {/* Pipeline stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">Pipeline value</p>
            <p className="font-display text-3xl text-ee-gold">
              {totalAddressable >= 1
                ? `$${totalAddressable.toFixed(totalAddressable >= 10 ? 0 : 1)}M`
                : `$${(totalAddressable * 1000).toFixed(0)}K`}
            </p>
            <p className="text-xs text-ee-muted mt-1">Addressable across active deals</p>
          </div>
          <div className="glass-panel p-5">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">Active deals</p>
            <p className="font-display text-3xl text-ee-emerald">{active.length}</p>
            <p className="text-xs text-ee-muted mt-1">Accepted introductions</p>
          </div>
          <div className="glass-panel p-5">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">In progress</p>
            <p className="font-display text-3xl text-ee-primary">{introduced.length}</p>
            <p className="text-xs text-ee-muted mt-1">Pending response</p>
          </div>
          <div className="glass-panel p-5">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">Closed</p>
            <p className="font-display text-3xl text-ee-muted">{closed.length}</p>
            <p className="text-xs text-ee-muted mt-1">Declined or completed</p>
          </div>
        </div>

        {/* Pipeline columns */}
        <div>
          <h2 className="font-display text-lg text-ee-primary mb-3">Deal flow</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Column
              title="Introduced"
              count={introduced.length}
              color="#e9c176"
              items={introduced}
              emptyText="No pending introductions. Request one from a match card."
            />
            <Column
              title="Active"
              count={active.length}
              color="#4edea3"
              items={active}
              emptyText="No active relationships yet."
            />
            <Column
              title="Closed"
              count={closed.length}
              color="#8892a4"
              items={closed}
              emptyText="No closed deals."
            />
          </div>
        </div>

        <p className="text-xs text-ee-muted text-center">
          Deal stage tracking beyond introduction (diligence, terms, close) is on the roadmap.
        </p>
      </div>
    </div>
  )
}

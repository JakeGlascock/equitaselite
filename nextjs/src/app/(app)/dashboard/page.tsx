import Link from 'next/link'
import { redirect } from 'next/navigation'
import MatchCard from '@/components/MatchCard'
import MatchingExplainer from './MatchingExplainer'
import {
  getMe, getCandidates, getIntroductions,
  buildIntroMap, toMatchView, filterByKnockouts,
} from '@/lib/matches'
import { getActingAsState } from '@/lib/acting-as'
import { getTier, getLimits, priorityRank, checkIntroQuota } from '@/lib/membership'

export default async function DashboardPage() {
  const state = await getActingAsState()
  if (!state) redirect('/signin')
  const userId = state.effectiveUserId

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const [rawCandidates, intros, tier, quota] = await Promise.all([
    getCandidates(me),
    getIntroductions(userId),
    getTier(userId),
    checkIntroQuota(userId),
  ])
  // Phase 6 — viewer's knockouts hide counterparties entirely before
  // ranking. Asymmetric: applies only the viewer's hard filters.
  const candidates = filterByKnockouts(me, rawCandidates)
  const limits  = getLimits(tier)
  const introMap = buildIntroMap(intros, userId)

  // Sort candidates by (membership priority rank, score desc) so higher-tier
  // counterparties surface first. Then cap the user's view at their tier's
  // matches-per-month limit (null = unlimited).
  const ranked = candidates
    .map(c => ({ c, view: toMatchView(c, me, introMap.get(c.id)) }))
    .sort((a, b) => {
      const pa = priorityRank(a.c.membership)
      const pb = priorityRank(b.c.membership)
      if (pa !== pb) return pa - pb
      return b.view.score.total - a.view.score.total
    })

  const totalAvailable = ranked.length
  const matches = limits.matchesPerMonth != null
    ? ranked.slice(0, limits.matchesPerMonth).map(r => r.view)
    : ranked.map(r => r.view)
  const capped = matches.length < totalAvailable

  const pendingIncoming = intros.filter(i => i.recipient_id === userId && i.status === 'pending').length
  const firstName = me.full_name.split(' ')[0]
  const roleLabel = me.role === 'angel' ? 'Family Offices' : 'Angel Investors'

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Executive Overview</p>
            <h1 className="font-display text-3xl text-ee-gold mt-1">Welcome back, {firstName}</h1>
            <p className="text-ee-muted text-sm mt-1">
              {matches.length > 0
                ? <>
                    {capped
                      ? <><strong className="text-ee-primary">{matches.length}</strong> of {totalAvailable} {roleLabel} shown</>
                      : <><strong className="text-ee-primary">{matches.length}</strong> {roleLabel} matched to your mandate</>}
                    {' · '}{pendingIncoming} pending request{pendingIncoming === 1 ? '' : 's'}
                  </>
                : `No ${roleLabel} have completed their profiles yet`}
            </p>
          </div>
          <div className="pt-2 shrink-0">
            <MatchingExplainer />
          </div>
        </div>

        {/* Tier-based banners */}
        {capped && (
          <div className="glass-panel p-4 flex items-center justify-between gap-4 border-ee-gold/30">
            <p className="text-sm text-ee-muted">
              Your <strong className="text-ee-primary">Access</strong> plan shows the top {limits.matchesPerMonth} matches.
              Unlock all {totalAvailable} by upgrading.
            </p>
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Upgrade →
            </Link>
          </div>
        )}
        {!quota.ok && totalAvailable > 0 && (
          <div className="glass-panel p-4 flex items-center justify-between gap-4 border-ee-gold/30">
            <p className="text-sm text-ee-muted">
              {limits.introsPerMonth === 0
                ? <>Introductions aren&apos;t included on <strong className="text-ee-primary">Access</strong>. Upgrade to send curated requests.</>
                : <>You&apos;ve used all {limits.introsPerMonth} of your monthly introductions. Upgrade to Sovereign for unlimited.</>}
            </p>
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs">
              Upgrade →
            </Link>
          </div>
        )}

        {matches.length === 0 ? (
          <div data-tour="match-list" className="glass-panel p-10 text-center">
            <p className="text-ee-muted text-sm">
              Check back soon — we&apos;re onboarding {roleLabel.toLowerCase()} now.
            </p>
          </div>
        ) : (
          <div data-tour="match-list" className="space-y-4">
            {matches.map(m => (
              <MatchCard key={m.id} match={m} canSendIntros={quota.ok} viewerIsOffMarket={!!me.is_off_market} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import MatchCard from '@/components/MatchCard'
import MatchingExplainer from './MatchingExplainer'
import {
  getMe, getCandidates, getIntroductions, applyMandateToProfile,
  buildIntroMap, toMatchView, filterByKnockouts,
} from '@/lib/matches'
import { getMandate, type Role } from '@/lib/mandates'
import { getActingAsState } from '@/lib/acting-as'
import { getTier, getLimits, priorityRank, checkIntroQuota } from '@/lib/membership'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const state = await getActingAsState()
  if (!state) redirect('/signin')
  const userId = state.effectiveUserId

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  // Multi-role context selector. Chelsea = Angel + FO needs to pick
  // which side of the market she's browsing as; the candidate list +
  // her own scoring mandate switch accordingly. Single-role users see
  // no selector and their (one) role is the implicit context.
  const params       = await searchParams
  const isAngel      = !!me.is_angel         || me.role === 'angel'
  const isFamilyOffice = !!me.is_family_office || me.role === 'family_office'
  const multiRole    = isAngel && isFamilyOffice
  const paramRole    = params.role === 'angel' || params.role === 'family_office' ? params.role : null
  const viewerRole: Role | null =
       (paramRole && (paramRole === 'angel' ? isAngel : isFamilyOffice) ? paramRole as Role : null)
    ?? (isAngel && !isFamilyOffice ? 'angel'         : null)
    ?? (isFamilyOffice && !isAngel ? 'family_office' : null)
    ?? (isAngel ? 'angel' : isFamilyOffice ? 'family_office' : null)

  // Concierge-only profile (no investor role) — no match list to render.
  // Fall through to render the page with an empty matches array; the
  // existing "Check back soon" branch handles it gracefully.
  const viewerMandate = viewerRole ? await getMandate(userId, viewerRole) : null
  const scoringMe = viewerRole ? applyMandateToProfile(me, viewerMandate) : me

  const [rawCandidates, intros, tier, quota] = await Promise.all([
    viewerRole ? getCandidates(me, viewerRole) : Promise.resolve([]),
    getIntroductions(userId),
    getTier(userId),
    checkIntroQuota(userId),
  ])
  // Phase 6 — viewer's knockouts hide counterparties entirely before
  // ranking. Asymmetric: applies only the viewer's hard filters.
  const candidates = filterByKnockouts(scoringMe, rawCandidates)
  const limits  = getLimits(tier)
  const introMap = buildIntroMap(intros, userId)

  // Sort candidates by (membership priority rank, score desc) so higher-tier
  // counterparties surface first. Then cap the user's view at their tier's
  // matches-per-month limit (null = unlimited).
  const ranked = candidates
    .map(c => ({ c, view: toMatchView(c, scoringMe, introMap.get(c.id)) }))
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
  const roleLabel = viewerRole === 'angel' ? 'Family Offices'
                  : viewerRole === 'family_office' ? 'Angel Investors'
                  : 'counterparties'

  // Off-Market downgrade grace banner — surfaces when the viewer is
  // currently off-market AND has a future grace expiry on file (set
  // by the admin tier-change UPDATE when a Sovereign drops tier).
  // Shown on dashboard so it's seen during regular use, not only when
  // the user visits /profile. The visibility SQL fragment already
  // treats grace-expired rows as visible, so this only fires while
  // the timer is still ticking.
  const graceDate = me.off_market_grace_until
    ? new Date(me.off_market_grace_until)
    : null
  const inGrace = !!me.is_off_market
    && !!graceDate
    && graceDate.getTime() > Date.now()

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

        {/* Multi-role context selector — only rendered when the user
            holds BOTH investor roles. Toggles between "Viewing as
            Angel" (sees FOs) and "Viewing as Family Office" (sees
            Angels). Server-rendered via ?role= URL param so the
            choice is shareable and the scoring respects it cleanly. */}
        {multiRole && (
          <div className="glass-panel p-3 flex items-center gap-2 text-xs">
            <span className="font-data uppercase tracking-wider text-ee-muted shrink-0 px-2">Viewing as</span>
            <div className="flex gap-1">
              <Link
                href="/dashboard?role=angel"
                replace
                scroll={false}
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  viewerRole === 'angel'
                    ? 'bg-ee-gold text-ee-bg font-semibold'
                    : 'border border-ee-border text-ee-muted hover:text-ee-primary'
                }`}
              >
                Angel
              </Link>
              <Link
                href="/dashboard?role=family_office"
                replace
                scroll={false}
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  viewerRole === 'family_office'
                    ? 'bg-ee-gold text-ee-bg font-semibold'
                    : 'border border-ee-border text-ee-muted hover:text-ee-primary'
                }`}
              >
                Family Office
              </Link>
            </div>
            <span className="text-[11px] text-ee-muted/70 italic ml-auto pr-2 hidden sm:inline">
              Each role has its own mandate — switch to see the matches that fit.
            </span>
          </div>
        )}

        {/* Off-Market downgrade grace warning. Re-upgrading to Sovereign
            clears the timer (admin tier-change UPDATE handles this);
            otherwise the profile flips back to visible at graceDate. */}
        {inGrace && (
          <div className="glass-panel p-4 flex items-start justify-between gap-4 border-ee-gold/60 bg-ee-gold/[0.08]">
            <div className="flex items-start gap-3 min-w-0">
              <span className="material-symbols-outlined text-ee-gold shrink-0 mt-0.5">visibility</span>
              <div className="min-w-0">
                <p className="text-sm text-ee-primary font-semibold">
                  Your profile becomes visible on {graceDate!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-ee-muted mt-1 leading-relaxed">
                  You&apos;re currently in Off-Market mode, but your Sovereign tier ended. After this date, every member can see your profile in their match results. Re-upgrade to Sovereign to keep your profile private.
                </p>
              </div>
            </div>
            <Link href="/pricing" className="btn-gold whitespace-nowrap text-xs shrink-0">
              Re-upgrade →
            </Link>
          </div>
        )}

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

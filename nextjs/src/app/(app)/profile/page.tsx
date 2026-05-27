import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { queryOne, query } from '@/lib/db'
import { getMandate, type Role } from '@/lib/mandates'
import OnboardingForm from '@/app/onboarding/OnboardingForm'
import EmailPrefToggle from './EmailPrefToggle'
import OffMarketToggle from './OffMarketToggle'
import PasskeysSection from './PasskeysSection'
import IdentityPanel from './IdentityPanel'
import WalkthroughReplay from './WalkthroughReplay'
import MandatePillarsForm from './MandatePillarsForm'
import MandateWeightsForm from './MandateWeightsForm'
import KnockoutsReview, { type KnockoutSummaryItem } from './KnockoutsReview'
import { getCandidates, type DbProfile as MatchDbProfile } from '@/lib/matches'
import { countKnockoutsByReason } from '@/lib/scoring'
import { getTier } from '@/lib/membership'
import { DEFAULT_MANDATE_WEIGHTS, type UserProfile, type Tier, type MandateWeights } from '@/types'

interface DbProfile {
  id: string
  email: string
  role: 'angel' | 'family_office'
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  aum: string | null
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  risk_tolerance: string | null
  expected_return: string | null
  timeline: string | null
  mandate_type: string | null
  concentration: string | null
  email_notifications_enabled: boolean | null
  onboarding_completed: boolean
  is_off_market:          boolean | null
  off_market_grace_until: Date | string | null
  // Multi-role identity (migrations 034 + 035). The select * fetch
  // picks these up automatically once the migrations have run;
  // defaulted to null on pre-migration environments so the
  // IdentityPanel still renders.
  is_angel:             boolean | null
  is_family_office:     boolean | null
  is_next_gen:          boolean | null
  is_family_foundation: boolean | null
  is_daf:               boolean | null
  is_concierge:         boolean | null
  // Phase 6 mandate pillar fields — all nullable, all defaulted via
  // migration 028 so a SELECT * always returns them on a profile that
  // hasn't customized yet.
  sub_sectors:    string[] | null
  anti_sectors:   string[] | null
  thematic_focus: string[] | null
  asset_classes:  string[] | null
  lead_capacity:  'lead' | 'follow' | 'either' | null
  holding_period_target_years: string | number | null
  loss_appetite:  'low' | 'moderate' | 'high' | null
  engagement_style: 'board' | 'observer' | 'advisory' | 'passive' | null
  diligence_depth:  'light' | 'standard' | 'deep' | null
  min_counterparty_tier: 'access' | 'select' | 'sovereign' | null
  esg_required:     boolean | null
  impact_themes:    string[] | null
  values_exclusions: string[] | null
  // Per-user pillar weights. JSONB column populated with the default
  // weights at row creation (see migration 028), so this should never
  // be null in practice — but we fall back to DEFAULT_MANDATE_WEIGHTS
  // defensively to handle older rows or partial backfills.
  mandate_weights:  MandateWeights | null
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/signin')

  const profile = await queryOne<DbProfile>(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  // Off-Market: look up the live tier (membership column may lag if a
  // downgrade just happened) and forward the grace-until timestamp so
  // the toggle component can show the countdown.
  const tier = await getTier(userId)

  // Lazy grace expiry. The visibility SQL fragment already respects
  // off_market_grace_until <= NOW() so visibility is correct regardless,
  // but this UPDATE catches the row up so the toggle in the UI reflects
  // what's actually being served. Idempotent + race-safe under the
  // matching WHERE clause.
  if (profile.is_off_market && profile.off_market_grace_until) {
    const expires = new Date(profile.off_market_grace_until)
    if (expires.getTime() <= Date.now()) {
      try {
        await query(
          `UPDATE profiles
              SET is_off_market = FALSE, off_market_grace_until = NULL
            WHERE id = $1 AND off_market_grace_until <= NOW() AND is_off_market = TRUE`,
          [userId],
        )
        profile.is_off_market          = false
        profile.off_market_grace_until = null
      } catch { /* pre-033 — column not present; no-op */ }
    }
  }

  const graceUntil = profile.off_market_grace_until
    ? (profile.off_market_grace_until instanceof Date
        ? profile.off_market_grace_until.toISOString()
        : profile.off_market_grace_until)
    : null

  // Per-role mandate editing (Phase D2 + E4). Multi-role users get a
  // tab switcher above the mandate form: which role's mandate are we
  // editing? Single-role users see no tabs. Concierge-only users have
  // no mandate to edit; the form still shows for identity fields.
  const params         = await searchParams
  const { rolesHeldBy, ROLE_LABELS, INVESTOR_ROLES } = await import('@/lib/role-compat')
  const heldRoles      = rolesHeldBy({
    is_angel:             !!profile.is_angel             || profile.role === 'angel',
    is_family_office:     !!profile.is_family_office     || profile.role === 'family_office',
    is_next_gen:          !!profile.is_next_gen,
    is_family_foundation: !!profile.is_family_foundation,
    is_daf:               !!profile.is_daf,
  })
  const multiRole = heldRoles.length > 1
  const paramRoleRaw = typeof params.role === 'string' ? params.role : null
  const editRole: Role | null =
       (paramRoleRaw && heldRoles.includes(paramRoleRaw as Role) ? (paramRoleRaw as Role) : null)
    ?? (heldRoles[0] ?? null)

  // Load the role-specific mandate when available (mandates table is
  // authoritative once D2 is live). Falls back to profile columns for
  // users who haven't been migrated/edited yet.
  const mandate = editRole ? await getMandate(userId, editRole) : null
  const m = {
    aum:             mandate?.aum             ?? profile.aum             ?? '',
    sectors:         mandate?.sectors         ?? profile.sectors,
    stages:          mandate?.stages          ?? profile.stages,
    geography:       mandate?.geography       ?? profile.geography,
    check_size_min:  Number(mandate?.check_size_min  ?? profile.check_size_min),
    check_size_max:  Number(mandate?.check_size_max  ?? profile.check_size_max),
    risk_tolerance:  (mandate?.risk_tolerance  ?? profile.risk_tolerance) ?? '',
    expected_return: (mandate?.expected_return ?? profile.expected_return) ?? '',
    timeline:        (mandate?.timeline        ?? profile.timeline) ?? '',
    mandate_type:    (mandate?.mandate_type    ?? profile.mandate_type) ?? '',
    concentration:   (mandate?.concentration   ?? profile.concentration) ?? '',
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Settings</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Edit profile</h1>
          <p className="text-ee-muted text-sm mt-1">
            Changes update your match scores immediately.
          </p>
        </div>

        {/* Identity — Angel / FO / Next Gen / Foundation / DAF
            (Concierge is admin-controlled and shown read-only). */}
        <IdentityPanel
          initialIsAngel={!!profile.is_angel || profile.role === 'angel'}
          initialIsFamilyOffice={!!profile.is_family_office || profile.role === 'family_office'}
          initialIsNextGen={!!profile.is_next_gen}
          initialIsFamilyFoundation={!!profile.is_family_foundation}
          initialIsDaf={!!profile.is_daf}
          isConcierge={!!profile.is_concierge}
        />

        {/* Top-level email opt-out, separate from the wizard form so it's
            never more than one click away. */}
        <EmailPrefToggle initial={profile.email_notifications_enabled ?? true} />

        {/* Off-Market mode — Sovereign-tier privacy toggle. Rendered for
            every tier so lower tiers can see what they'd unlock; the
            client component disables itself when tier !== sovereign. */}
        <OffMarketToggle
          initial={!!profile.is_off_market}
          tier={tier}
          graceUntil={graceUntil}
        />

        <WalkthroughReplay />

        {/* Passkeys management — Face ID / Touch ID / hardware key
            registration + listing + removal. When at least one passkey
            is registered, /signin shows a "Sign in with passkey"
            button alongside email+password. */}
        <PasskeysSection />

        {/* Multi-role: tabs choose which mandate the form below edits.
            URL-driven (?role=) so the choice round-trips through the
            server-rendered form. Single-role users skip this block. */}
        {multiRole && (
          <div className="glass-panel p-3 flex items-center gap-2 text-xs flex-wrap">
            <span className="font-data uppercase tracking-wider text-ee-muted shrink-0 px-2">Editing mandate</span>
            <div className="flex gap-1 flex-wrap">
              {INVESTOR_ROLES.filter(r => heldRoles.includes(r)).map(r => (
                <Link
                  key={r}
                  href={`/profile?role=${r}`}
                  replace
                  scroll={false}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    editRole === r
                      ? 'bg-ee-gold text-ee-bg font-semibold'
                      : 'border border-ee-border text-ee-muted hover:text-ee-primary'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </Link>
              ))}
            </div>
            <span className="text-[11px] text-ee-muted/70 italic ml-auto pr-2 hidden sm:inline">
              Each role has its own mandate.
            </span>
          </div>
        )}

        <OnboardingForm
          // Force a remount when the editRole changes so the form
          // re-reads its initialData (state is mounted-once otherwise).
          key={editRole ?? 'no-role'}
          email={profile.email}
          mode="edit"
          editRole={editRole ?? undefined}
          initialData={{
            is_angel:             heldRoles.includes('angel'),
            is_family_office:     heldRoles.includes('family_office'),
            is_next_gen:          heldRoles.includes('next_gen'),
            is_family_foundation: heldRoles.includes('family_foundation'),
            is_daf:               heldRoles.includes('daf'),
            full_name:       profile.full_name,
            title:           profile.title          ?? '',
            firm_name:       profile.firm_name,
            location:        profile.location        ?? '',
            aum:             m.aum,
            sectors:         m.sectors,
            stages:          m.stages,
            geography:       m.geography,
            check_size_min:  m.check_size_min,
            check_size_max:  m.check_size_max,
            risk_tolerance:  m.risk_tolerance,
            expected_return: m.expected_return,
            timeline:        m.timeline,
            mandate_type:    m.mandate_type,
            concentration:   m.concentration,
            email_notifications_enabled: profile.email_notifications_enabled ?? true,
          }}
        />

        {/* Phase F — weights editor (preset picker + 6 sliders).
            Determines how each pillar contributes to this user's
            personal view of match scores. */}
        <MandateWeightsForm initial={profile.mandate_weights ?? DEFAULT_MANDATE_WEIGHTS} />

        {/* Phase E — knockouts review. Renders nothing when the user has
            no hard filters set; surfaces what's hidden when they do. */}
        {await renderKnockoutsReview(profile)}

        <MandatePillarsForm
          initial={{
            sub_sectors:    profile.sub_sectors    ?? [],
            anti_sectors:   profile.anti_sectors   ?? [],
            thematic_focus: profile.thematic_focus ?? [],
            asset_classes:  profile.asset_classes  ?? [],
            lead_capacity:  profile.lead_capacity ?? null,
            holding_period_target_years: profile.holding_period_target_years != null
              ? Number(profile.holding_period_target_years)
              : null,
            loss_appetite:        profile.loss_appetite ?? null,
            engagement_style:     profile.engagement_style ?? null,
            diligence_depth:      profile.diligence_depth  ?? null,
            min_counterparty_tier: profile.min_counterparty_tier ?? null,
            esg_required:      profile.esg_required ?? false,
            impact_themes:     profile.impact_themes    ?? [],
            values_exclusions: profile.values_exclusions ?? [],
          }}
        />
      </div>
    </div>
  )
}

// Renders the knockouts-review panel if the viewer has any hard filters
// active. Computes counts by running the same filter logic the
// dashboard uses against the candidate pool. Falls back to rendering
// nothing on any error so the profile page never breaks because of this
// auxiliary panel.
async function renderKnockoutsReview(profile: DbProfile) {
  try {
    // Build a UserProfile shape for the knockout helpers (camelCase).
    const viewer: UserProfile = {
      id:           profile.id,
      email:        profile.email,
      role:         profile.role,
      firmName:     profile.firm_name,
      sectors:      profile.sectors,
      stages:       profile.stages,
      geography:    profile.geography,
      checkSizeMin: Number(profile.check_size_min),
      checkSizeMax: Number(profile.check_size_max),
      antiSectors:         profile.anti_sectors   ?? [],
      valuesExclusions:    profile.values_exclusions ?? [],
      minCounterpartyTier: profile.min_counterparty_tier ?? null,
      esgRequired:         profile.esg_required ?? false,
      createdAt: '', updatedAt: '',
    }

    // Build the summary items based on which knockout fields are set.
    const items: KnockoutSummaryItem[] = []
    if (viewer.antiSectors?.length) {
      items.push({
        reason:  'anti_sectors',
        label:   'Anti-sectors',
        detail:  viewer.antiSectors.join(', '),
        blocked: 0,
      })
    }
    if (viewer.valuesExclusions?.length) {
      items.push({
        reason:  'values_exclusions',
        label:   'Values exclusions',
        detail:  viewer.valuesExclusions.join(', '),
        blocked: 0,
      })
    }
    if (viewer.minCounterpartyTier) {
      const tier = viewer.minCounterpartyTier as Tier
      items.push({
        reason:  'min_counterparty_tier',
        label:   'Minimum counterparty tier',
        detail:  tier.charAt(0).toUpperCase() + tier.slice(1) + ' or higher',
        blocked: 0,
      })
    }
    if (viewer.esgRequired) {
      items.push({
        reason:  'esg_required',
        label:   'ESG required',
        detail:  'Only counterparties who have declared ESG alignment',
        blocked: 0,
      })
    }
    if (items.length === 0) return null

    // Fetch candidates and compute per-reason block counts. getCandidates
    // expects the wider MatchDbProfile but only reads role/id/etc., so
    // the SELECT * row above is a superset and casts cleanly.
    const candidates = await getCandidates(profile as unknown as MatchDbProfile)
    const candidateScoring = candidates.map(c => ({
      id:           c.id,
      role:         c.role,
      firmName:     c.firm_name,
      sectors:      c.sectors,
      stages:       c.stages,
      geography:    c.geography,
      checkSizeMin: Number(c.check_size_min),
      checkSizeMax: Number(c.check_size_max),
      membership:   c.membership ?? null,
      esgRequired:  c.esg_required ?? false,
      impactThemes: c.impact_themes ?? [],
      bio:          '',
      isVerified:   false,
    }))
    const counts = countKnockoutsByReason(viewer, candidateScoring)
    for (const item of items) item.blocked = counts[item.reason]

    const totalBlocked = items.reduce((s, i) => s + i.blocked, 0)
    return (
      <KnockoutsReview
        totalCandidates={candidates.length}
        totalBlocked={totalBlocked}
        items={items}
      />
    )
  } catch {
    return null
  }
}

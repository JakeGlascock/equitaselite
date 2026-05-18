import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import OnboardingForm from '@/app/onboarding/OnboardingForm'
import EmailPrefToggle from './EmailPrefToggle'
import WalkthroughReplay from './WalkthroughReplay'
import MandatePillarsForm from './MandatePillarsForm'

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
  // Phase 6 mandate pillar fields — all nullable, all defaulted via
  // migration 028 so a SELECT * always returns them on a profile that
  // hasn't customized yet.
  sub_sectors:    string[] | null
  anti_sectors:   string[] | null
  thematic_focus: string[] | null
  lead_capacity:  'lead' | 'follow' | 'either' | null
  holding_period_target_years: string | number | null
  loss_appetite:  'low' | 'moderate' | 'high' | null
  engagement_style: 'board' | 'observer' | 'advisory' | 'passive' | null
  diligence_depth:  'light' | 'standard' | 'deep' | null
  min_counterparty_tier: 'access' | 'select' | 'sovereign' | null
  esg_required:     boolean | null
  impact_themes:    string[] | null
  values_exclusions: string[] | null
}

export default async function ProfilePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/signin')

  const profile = await queryOne<DbProfile>(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

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

        {/* Top-level email opt-out, separate from the wizard form so it's
            never more than one click away. */}
        <EmailPrefToggle initial={profile.email_notifications_enabled ?? true} />

        <WalkthroughReplay />

        <OnboardingForm
          email={profile.email}
          mode="edit"
          initialData={{
            role:            profile.role,
            full_name:       profile.full_name,
            title:           profile.title          ?? '',
            firm_name:       profile.firm_name,
            location:        profile.location        ?? '',
            aum:             profile.aum             ?? '',
            sectors:         profile.sectors,
            stages:          profile.stages,
            geography:       profile.geography,
            check_size_min:  Number(profile.check_size_min),
            check_size_max:  Number(profile.check_size_max),
            risk_tolerance:  profile.risk_tolerance  ?? '',
            expected_return: profile.expected_return ?? '',
            timeline:        profile.timeline        ?? '',
            mandate_type:    profile.mandate_type    ?? '',
            concentration:   profile.concentration   ?? '',
            email_notifications_enabled: profile.email_notifications_enabled ?? true,
          }}
        />

        <MandatePillarsForm
          initial={{
            sub_sectors:    profile.sub_sectors    ?? [],
            anti_sectors:   profile.anti_sectors   ?? [],
            thematic_focus: profile.thematic_focus ?? [],
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

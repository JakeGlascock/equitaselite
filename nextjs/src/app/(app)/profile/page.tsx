import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import OnboardingForm from '@/app/onboarding/OnboardingForm'
import EmailPrefToggle from './EmailPrefToggle'
import WalkthroughReplay from './WalkthroughReplay'

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
      </div>
    </div>
  )
}

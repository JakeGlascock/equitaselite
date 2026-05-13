import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import OnboardingForm from '@/app/onboarding/OnboardingForm'

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
  onboarding_completed: boolean
}

export default async function ProfilePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/')

  const profile = await queryOne<DbProfile>(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ee-gold">Edit profile</h1>
            <p className="text-ee-muted text-sm mt-1">
              Changes update your match scores immediately.
            </p>
          </div>
          <a href="/dashboard" className="text-xs text-ee-muted hover:text-ee-primary transition-colors">
            ← Back
          </a>
        </div>
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
          }}
        />
      </div>
    </main>
  )
}

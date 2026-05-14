import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import OnboardingForm from './OnboardingForm'

interface Profile {
  onboarding_completed: boolean
  email: string
}

export default async function OnboardingPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  if (!userId) redirect('/signin')

  const profile = await queryOne<Profile>(
    'SELECT onboarding_completed, email FROM profiles WHERE id = $1',
    [userId]
  )

  if (profile?.onboarding_completed) redirect('/dashboard')

  const email = profile?.email ?? headersList.get('x-user-email') ?? ''

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ee-gold">Complete your profile</h1>
          <p className="text-ee-muted text-sm mt-2">
            This takes about 2 minutes. Your answers power the matching algorithm.
          </p>
        </div>
        <OnboardingForm email={email} />
      </div>
    </main>
  )
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'

interface Profile {
  onboarding_completed: boolean
  full_name: string
  role: string
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  if (!userId) redirect('/')

  const profile = await queryOne<Profile>(
    'SELECT onboarding_completed, full_name, role FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel p-8 text-center">
        <h1 className="font-display text-2xl text-ee-gold mb-2">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="text-ee-muted text-sm">Dashboard coming soon.</p>
      </div>
    </main>
  )
}

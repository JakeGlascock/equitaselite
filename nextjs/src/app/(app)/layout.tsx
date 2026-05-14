import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import AppShell from '@/components/AppShell'

interface ShellProfile {
  full_name: string
  role:      'angel' | 'family_office'
  onboarding_completed: boolean
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')

  const profile = await queryOne<ShellProfile>(
    'SELECT full_name, role, onboarding_completed FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  const isAdmin = await isUserAdmin(userId, userEmail)

  return (
    <AppShell user={{ fullName: profile.full_name, role: profile.role, isAdmin }}>
      {children}
    </AppShell>
  )
}

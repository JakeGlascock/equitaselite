import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { getActingAsState, type ManagedProfileLite } from '@/lib/acting-as'
import AppShell from '@/components/AppShell'

interface ShellProfile {
  full_name: string
  role:      'angel' | 'family_office'
  onboarding_completed: boolean
  is_concierge?: boolean
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')

  let profile: ShellProfile | null = null
  try {
    profile = await queryOne<ShellProfile>(
      'SELECT full_name, role, onboarding_completed, is_concierge FROM profiles WHERE id = $1',
      [userId]
    )
  } catch {
    profile = await queryOne<ShellProfile>(
      'SELECT full_name, role, onboarding_completed FROM profiles WHERE id = $1',
      [userId]
    )
  }

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  const isAdmin      = await isUserAdmin(userId, userEmail)
  const isConcierge  = !!profile.is_concierge
  const actingAs     = isConcierge ? await getActingAsState() : null
  const managedAs: ManagedProfileLite | null = actingAs?.managedProfile ?? null

  return (
    <AppShell
      user={{ fullName: profile.full_name, role: profile.role, isAdmin, isConcierge }}
      actingAs={managedAs}
    >
      {children}
    </AppShell>
  )
}

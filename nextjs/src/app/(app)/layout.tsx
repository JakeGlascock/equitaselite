import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import AppShell from '@/components/AppShell'

interface ShellProfile {
  full_name: string
  role:      'angel' | 'family_office'
  onboarding_completed: boolean
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')?.toLowerCase() ?? ''
  if (!userId) redirect('/signin')

  const profile = await queryOne<ShellProfile>(
    'SELECT full_name, role, onboarding_completed FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  const isAdmin = adminEmails.includes(userEmail)

  return (
    <AppShell user={{ fullName: profile.full_name, role: profile.role, isAdmin }}>
      {children}
    </AppShell>
  )
}

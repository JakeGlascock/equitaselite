import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { getActingAsState, type ManagedProfileLite } from '@/lib/acting-as'
import { getTier } from '@/lib/membership'
import AppShell from '@/components/AppShell'

interface ShellProfile {
  full_name: string
  role:      'angel' | 'family_office'
  onboarding_completed: boolean
  is_concierge?: boolean
  walkthrough_seen_at?: Date | string | null
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')

  // Try the fullest SELECT first; fall back twice for environments where
  // migration 007 (is_concierge) or 016 (walkthrough_seen_at) hasn't run yet.
  let profile: ShellProfile | null = null
  try {
    profile = await queryOne<ShellProfile>(
      'SELECT full_name, role, onboarding_completed, is_concierge, walkthrough_seen_at FROM profiles WHERE id = $1',
      [userId]
    )
  } catch {
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
  }

  if (!profile || !profile.onboarding_completed) redirect('/onboarding')

  const isAdmin      = await isUserAdmin(userId, userEmail)
  const isConcierge  = !!profile.is_concierge
  const actingAs     = isConcierge ? await getActingAsState() : null
  const managedAs: ManagedProfileLite | null = actingAs?.managedProfile ?? null

  // When operating as a managed account, show that profile's tier (not the
  // concierge's own) so the badge reflects what the concierge is operating on.
  const tierUserId = actingAs?.managedProfile?.id ?? userId
  const tier       = await getTier(tierUserId)

  // Walkthrough is pending if the user has completed onboarding but the
  // column is still NULL (or undefined on pre-migration environments —
  // treat undefined as "already seen" to avoid surprising existing users).
  const walkthroughPending =
    profile.walkthrough_seen_at === null &&
    profile.onboarding_completed

  // Managed Sovereigns get a different welcome step in the tour. Detect
  // via the id prefix established by the concierge onboarding-on-behalf
  // flow (see scripts that mint managed_* ids in /api/concierge/**).
  const isManaged = userId.startsWith('managed_')

  // Investor-preview mode — middleware sets this header after threading
  // through the ee_preview cookie. In this branch the user is browsing
  // as a demo profile; we suppress the regular walkthrough (their seen-at
  // would be stamped from the seed anyway) and the AppShell mounts a
  // preview-specific banner + tour instead.
  const previewMode = h.get('x-preview-mode') === '1'

  return (
    <AppShell
      user={{ fullName: profile.full_name, role: profile.role, isAdmin, isConcierge, isManaged, tier }}
      actingAs={managedAs}
      walkthroughPending={walkthroughPending && !previewMode}
      previewMode={previewMode}
    >
      {children}
    </AppShell>
  )
}

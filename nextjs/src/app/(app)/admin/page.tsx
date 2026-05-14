import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { listCognitoUsers } from '@/lib/auth'
import { isUserAdmin } from '@/lib/admin'
import InviteForm from './InviteForm'
import SeedDemoButton from './SeedDemoButton'
import InitNotificationsButton from './InitNotificationsButton'
import InitEmailPrefButton from './InitEmailPrefButton'
import InitIsAdminButton from './InitIsAdminButton'
import InitConciergeButton from './InitConciergeButton'
import InitAccessRequestsButton from './InitAccessRequestsButton'
import AdminToggle from './AdminToggle'
import ConciergeToggle from './ConciergeToggle'

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  firm_name: string | null
  role: 'angel' | 'family_office' | null
  onboarding_completed: boolean
  is_admin: boolean | null
  is_concierge: boolean | null
  created_at: Date | string
}

type MemberStatus = 'Invited' | 'Onboarding' | 'Active' | 'Disabled' | 'Demo'

interface MergedRow {
  email:    string
  name:     string | null
  firm:     string | null
  role:     'angel' | 'family_office' | null
  status:   MemberStatus
  joined:   string
  userId:   string | null       // profile id, if any
  isAdmin:  boolean              // current admin state
  isConcierge: boolean            // current concierge state
  togglable: boolean             // whether the toggle should be enabled
  toggleReason?: string
}

function toIso(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (d instanceof Date) return d.toISOString()
  return d
}

function fmtDate(s: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<MemberStatus, string> = {
  Active:     'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
  Onboarding: 'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
  Invited:    'border-ee-primary/30 bg-ee-primary/10 text-ee-primary',
  Disabled:   'border-ee-border     bg-white/5       text-ee-muted',
  Demo:       'border-ee-border     bg-white/5       text-ee-muted',
}

const STATUS_ORDER: Record<MemberStatus, number> = {
  Invited: 0, Onboarding: 1, Active: 2, Disabled: 3, Demo: 4,
}

export default async function AdminPage() {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')
  if (!(await isUserAdmin(userId, userEmail))) redirect('/dashboard')

  // Profiles may not yet have the is_admin column (before init-is-admin runs).
  // Try the column-aware query first, fall back to without.
  let profiles: ProfileRow[]
  try {
    profiles = await query<ProfileRow>(
      `SELECT id, email, full_name, firm_name, role, onboarding_completed,
              is_admin, is_concierge, created_at
       FROM profiles
       ORDER BY created_at DESC`
    )
  } catch {
    try {
      profiles = (await query<Omit<ProfileRow, 'is_concierge'>>(
        `SELECT id, email, full_name, firm_name, role, onboarding_completed,
                is_admin, created_at
         FROM profiles
         ORDER BY created_at DESC`
      )).map(p => ({ ...p, is_concierge: null }))
    } catch {
      profiles = (await query<Omit<ProfileRow, 'is_admin' | 'is_concierge'>>(
        `SELECT id, email, full_name, firm_name, role, onboarding_completed, created_at
         FROM profiles
         ORDER BY created_at DESC`
      )).map(p => ({ ...p, is_admin: null, is_concierge: null }))
    }
  }

  const cognitoUsers = await listCognitoUsers().catch(err => {
    console.error('listCognitoUsers failed:', err)
    return [] as Awaited<ReturnType<typeof listCognitoUsers>>
  })

  const profileByEmail = new Map(profiles.map(p => [p.email.toLowerCase(), p]))
  const merged: MergedRow[] = []

  for (const u of cognitoUsers) {
    const p = profileByEmail.get(u.email)
    let status: MemberStatus
    if (!u.enabled)                   status = 'Disabled'
    else if (!p)                       status = 'Invited'
    else if (!p.onboarding_completed)  status = 'Onboarding'
    else                               status = 'Active'

    const togglable = !!p && status !== 'Disabled'
    merged.push({
      email:        u.email,
      name:         p?.full_name ?? null,
      firm:         p?.firm_name ?? null,
      role:         p?.role ?? null,
      status,
      joined:       toIso(p?.created_at) || u.createdAt,
      userId:       p?.id ?? null,
      isAdmin:      p?.is_admin ?? false,
      isConcierge:  p?.is_concierge ?? false,
      togglable,
      toggleReason: !p ? 'Profile not created yet' : status === 'Disabled' ? 'User is disabled' : undefined,
    })
  }

  for (const p of profiles) {
    if (!p.id.startsWith('demo_')) continue
    merged.push({
      email:        p.email,
      name:         p.full_name,
      firm:         p.firm_name,
      role:         p.role,
      status:       'Demo',
      joined:       toIso(p.created_at),
      userId:       p.id,
      isAdmin:      p.is_admin ?? false,
      isConcierge:  p.is_concierge ?? false,
      togglable:    false,
      toggleReason: 'Demo accounts cannot be made admin or concierge',
    })
  }

  merged.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (s !== 0) return s
    return (b.joined ?? '').localeCompare(a.joined ?? '')
  })

  const counts = {
    invited:    merged.filter(m => m.status === 'Invited').length,
    onboarding: merged.filter(m => m.status === 'Onboarding').length,
    active:     merged.filter(m => m.status === 'Active').length,
    demo:       merged.filter(m => m.status === 'Demo').length,
    admins:     merged.filter(m => m.isAdmin).length,
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Operations</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Admin</h1>
          <p className="text-ee-muted text-sm mt-1">
            {merged.length} total · {counts.invited} invited · {counts.onboarding} onboarding · {counts.active} active · {counts.admins} {counts.admins === 1 ? 'admin' : 'admins'}
            {counts.demo > 0 && ` · ${counts.demo} demo`}
          </p>
        </div>

        <div className="glass-panel p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base text-ee-primary mb-1">Access requests</h2>
            <p className="text-xs text-ee-muted">
              Submissions from <code className="font-data">/request-access</code> on the landing page.
            </p>
          </div>
          <a href="/admin/access-requests" className="btn-ghost whitespace-nowrap">View →</a>
        </div>

        <InviteForm />
        <SeedDemoButton />
        <InitNotificationsButton />
        <InitEmailPrefButton />
        <InitIsAdminButton />
        <InitConciergeButton />
        <InitAccessRequestsButton />

        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-ee-border">
            <h2 className="font-display text-base text-ee-primary">Members</h2>
          </div>

          {merged.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ee-muted">
              No members yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
                  <th className="text-left  px-6 py-3 font-normal">Email</th>
                  <th className="text-left  px-6 py-3 font-normal">Name</th>
                  <th className="text-left  px-6 py-3 font-normal">Role</th>
                  <th className="text-left  px-6 py-3 font-normal">Status</th>
                  <th className="text-left  px-6 py-3 font-normal">Admin</th>
                  <th className="text-left  px-6 py-3 font-normal">Concierge</th>
                  <th className="text-right px-6 py-3 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {merged.map(m => (
                  <tr key={m.email} className="border-t border-ee-border/60">
                    <td className="px-6 py-3 text-ee-primary truncate max-w-[14rem]">{m.email}</td>
                    <td className="px-6 py-3 text-ee-muted">{m.name ?? '—'}</td>
                    <td className="px-6 py-3 text-ee-muted">
                      {m.role === 'angel' ? 'Angel' : m.role === 'family_office' ? 'Family Office' : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[m.status]}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {m.userId ? (
                        <AdminToggle
                          userId={m.userId}
                          initial={m.isAdmin}
                          selfUserId={userId}
                          disabled={!m.togglable}
                          disabledReason={m.toggleReason}
                        />
                      ) : (
                        <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {m.userId ? (
                        <ConciergeToggle
                          userId={m.userId}
                          initial={m.isConcierge}
                          disabled={!m.togglable}
                          disabledReason={m.toggleReason}
                        />
                      ) : (
                        <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-ee-muted">{fmtDate(m.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-ee-muted text-center">
          Admin status is granted per-user. <code className="font-data">ADMIN_EMAILS</code> remains as a break-glass fallback so the initial admin can always sign in.
        </p>
      </div>
    </div>
  )
}

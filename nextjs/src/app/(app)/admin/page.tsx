import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import InviteForm from './InviteForm'
import SeedDemoButton from './SeedDemoButton'
import InitNotificationsButton from './InitNotificationsButton'
import InitEmailPrefButton from './InitEmailPrefButton'

interface MemberRow {
  id: string
  email: string
  full_name: string | null
  firm_name: string | null
  role: 'angel' | 'family_office' | null
  onboarding_completed: boolean
  created_at: string
}

function isAdmin(email: string | null): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AdminPage() {
  const headersList = await headers()
  const userId    = headersList.get('x-user-id')
  const userEmail = headersList.get('x-user-email')
  if (!userId) redirect('/signin')
  if (!isAdmin(userEmail)) redirect('/dashboard')

  const members = await query<MemberRow>(
    `SELECT id, email, full_name, firm_name, role, onboarding_completed, created_at
     FROM profiles
     ORDER BY created_at DESC`
  )

  const onboarded = members.filter(m => m.onboarding_completed).length

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Operations</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Admin</h1>
          <p className="text-ee-muted text-sm mt-1">
            {members.length} {members.length === 1 ? 'member' : 'members'} ·{' '}
            {onboarded} onboarded
          </p>
        </div>

        <InviteForm />

        <SeedDemoButton />

        <InitNotificationsButton />

        <InitEmailPrefButton />

        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-ee-border">
            <h2 className="font-display text-base text-ee-primary">Members</h2>
          </div>

          {members.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ee-muted">
              No members yet. Invited users will appear here after they complete onboarding.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
                  <th className="text-left px-6 py-3 font-normal">Email</th>
                  <th className="text-left px-6 py-3 font-normal">Name</th>
                  <th className="text-left px-6 py-3 font-normal">Role</th>
                  <th className="text-left px-6 py-3 font-normal">Status</th>
                  <th className="text-right px-6 py-3 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-t border-ee-border/60">
                    <td className="px-6 py-3 text-ee-primary truncate max-w-[14rem]">{m.email}</td>
                    <td className="px-6 py-3 text-ee-muted">{m.full_name ?? '—'}</td>
                    <td className="px-6 py-3 text-ee-muted">
                      {m.role === 'angel' ? 'Angel' : m.role === 'family_office' ? 'Family Office' : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        m.onboarding_completed
                          ? 'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald'
                          : 'border-ee-gold/40 bg-ee-gold/10 text-ee-gold'
                      }`}>
                        {m.onboarding_completed ? 'Active' : 'Onboarding'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-ee-muted">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-ee-muted text-center">
          Invited users who haven&apos;t signed in yet won&apos;t appear here until they complete onboarding.
        </p>
      </div>
    </div>
  )
}

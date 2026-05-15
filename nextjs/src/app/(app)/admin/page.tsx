import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { listCognitoUsers } from '@/lib/auth'
import { isUserAdmin } from '@/lib/admin'
import InviteForm from './InviteForm'
import SeedDemoButton from './SeedDemoButton'
import BackfillPlaceholdersButton from './BackfillPlaceholdersButton'
import ManagedAccountAssignment from './ManagedAccountAssignment'
import MembersTable, { type MemberRow } from './MembersTable'
import CreateEventForm from './CreateEventForm'
import PreviewTokensPanel from './PreviewTokensPanel'
import DeckTokensPanel from './DeckTokensPanel'

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  firm_name: string | null
  role: 'angel' | 'family_office' | null
  onboarding_completed: boolean
  is_admin: boolean | null
  is_concierge: boolean | null
  managed_by: string | null
  membership: 'access' | 'select' | 'sovereign' | null
  relationship_manager_id: string | null
  created_at: Date | string
}

type MemberStatus = MemberRow['status']

function toIso(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (d instanceof Date) return d.toISOString()
  return d
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

  // Profiles may not yet have the is_admin / is_concierge / managed_by columns
  // (before the corresponding init buttons run). Try most-complete query first,
  // fall back progressively.
  let profiles: ProfileRow[]
  try {
    profiles = await query<ProfileRow>(
      `SELECT id, email, full_name, firm_name, role, onboarding_completed,
              is_admin, is_concierge, managed_by, membership,
              relationship_manager_id, created_at
       FROM profiles
       ORDER BY created_at DESC`
    )
  } catch {
    try {
      profiles = (await query<Omit<ProfileRow, 'relationship_manager_id'>>(
        `SELECT id, email, full_name, firm_name, role, onboarding_completed,
                is_admin, is_concierge, managed_by, membership, created_at
         FROM profiles
         ORDER BY created_at DESC`
      )).map(p => ({ ...p, relationship_manager_id: null }))
    } catch {
      try {
        profiles = (await query<Omit<ProfileRow, 'membership' | 'relationship_manager_id'>>(
          `SELECT id, email, full_name, firm_name, role, onboarding_completed,
                  is_admin, is_concierge, managed_by, created_at
           FROM profiles
           ORDER BY created_at DESC`
        )).map(p => ({ ...p, membership: null, relationship_manager_id: null }))
      } catch {
        try {
          profiles = (await query<Omit<ProfileRow, 'is_concierge' | 'managed_by' | 'membership' | 'relationship_manager_id'>>(
            `SELECT id, email, full_name, firm_name, role, onboarding_completed,
                    is_admin, created_at
             FROM profiles
             ORDER BY created_at DESC`
          )).map(p => ({ ...p, is_concierge: null, managed_by: null, membership: null, relationship_manager_id: null }))
        } catch {
          profiles = (await query<Omit<ProfileRow, 'is_admin' | 'is_concierge' | 'managed_by' | 'membership' | 'relationship_manager_id'>>(
            `SELECT id, email, full_name, firm_name, role, onboarding_completed, created_at
             FROM profiles
             ORDER BY created_at DESC`
          )).map(p => ({ ...p, is_admin: null, is_concierge: null, managed_by: null, membership: null, relationship_manager_id: null }))
        }
      }
    }
  }

  // Concierges and managed accounts. Both depend on the concierge columns.
  interface ConciergeOption { id: string; full_name: string; firm_name: string | null }
  interface ManagedRow {
    id: string
    full_name: string
    firm_name: string
    role: 'angel' | 'family_office'
    email: string
    managed_by: string | null
  }
  let concierges: ConciergeOption[] = []
  let managedAccounts: ManagedRow[]  = []
  try {
    concierges = await query<ConciergeOption>(
      `SELECT id, full_name, firm_name
       FROM profiles
       WHERE is_concierge = TRUE
       ORDER BY full_name`
    )
    managedAccounts = await query<ManagedRow>(
      `SELECT id, full_name, firm_name, role, email, managed_by
       FROM profiles
       WHERE managed_by IS NOT NULL
       ORDER BY created_at DESC`
    )
  } catch { /* concierge columns not yet initialized */ }

  // Existing events (for the admin CreateEventForm's "existing" list). The
  // table may not exist yet on first deploy with migration 010 pending —
  // fall back to empty.
  interface AdminEventRow {
    id:          string
    title:       string
    type:        'Summit' | 'Roundtable' | 'Webinar' | 'Showcase'
    date:        Date | string
    duration:    string
    location:    string
    capacity:    number
    registered:  number
    min_tier:    'access' | 'select' | 'sovereign'
  }
  let existingEvents: AdminEventRow[] = []
  try {
    existingEvents = await query<AdminEventRow>(
      `SELECT e.id, e.title, e.type, e.date, e.duration, e.location,
              e.capacity, e.min_tier, COUNT(r.user_id)::int AS registered
       FROM events e
       LEFT JOIN event_rsvps r ON r.event_id = e.id
       GROUP BY e.id
       ORDER BY e.date DESC
       LIMIT 25`
    )
  } catch { /* events table not yet migrated */ }
  const existingEventsForClient = existingEvents.map(ev => ({
    ...ev,
    date: ev.date instanceof Date ? ev.date.toISOString() : ev.date,
  }))

  // Demo profiles populate the "View as" dropdown in PreviewTokensPanel.
  // Falls back to empty if seed-demo-data hasn't run yet — the panel
  // handles the empty case gracefully.
  interface DemoProfile {
    id: string
    full_name: string
    firm_name: string
    role: 'angel' | 'family_office'
    membership: 'access' | 'select' | 'sovereign' | null
  }
  let demoProfiles: DemoProfile[] = []
  try {
    demoProfiles = await query<DemoProfile>(
      `SELECT id, full_name, firm_name, role, membership
         FROM profiles
        WHERE id LIKE 'demo\\_%' ESCAPE '\\'
          AND onboarding_completed = TRUE
        ORDER BY role, full_name`,
    )
  } catch { /* membership column may be missing on older envs */
    demoProfiles = await query<Omit<DemoProfile,'membership'>>(
      `SELECT id, full_name, firm_name, role
         FROM profiles
        WHERE id LIKE 'demo\\_%' ESCAPE '\\'
          AND onboarding_completed = TRUE
        ORDER BY role, full_name`,
    ).then(rows => rows.map(r => ({ ...r, membership: null })))
     .catch(() => [])
  }

  const cognitoUsers = await listCognitoUsers().catch(err => {
    console.error('listCognitoUsers failed:', err)
    return [] as Awaited<ReturnType<typeof listCognitoUsers>>
  })

  const profileByEmail = new Map(profiles.map(p => [p.email.toLowerCase(), p]))
  const merged: MemberRow[] = []

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
      managedBy:    p?.managed_by ?? null,
      membership:   p?.membership ?? null,
      relationshipManagerId: p?.relationship_manager_id ?? null,
      togglable,
      staffTogglable:    togglable,  // same gate for real users — admin can flip A/C/RM on any non-Disabled real user
      toggleReason:      !p ? 'Run "Backfill placeholder profiles" in Setup to activate toggles' : status === 'Disabled' ? 'User is disabled' : undefined,
      staffToggleReason: !p ? 'Run "Backfill placeholder profiles" in Setup to activate toggles' : status === 'Disabled' ? 'User is disabled' : undefined,
    })
  }

  for (const p of profiles) {
    if (!p.id.startsWith('demo_') && !p.id.startsWith('managed_')) continue
    const isDemo = p.id.startsWith('demo_')
    merged.push({
      email:        p.email,
      name:         p.full_name,
      firm:         p.firm_name,
      role:         p.role,
      status:       isDemo ? 'Demo' : (p.onboarding_completed ? 'Active' : 'Onboarding'),
      joined:       toIso(p.created_at),
      userId:       p.id,
      isAdmin:      p.is_admin ?? false,
      isConcierge:  p.is_concierge ?? false,
      managedBy:    p.managed_by ?? null,
      membership:   p.membership ?? null,
      relationshipManagerId: p.relationship_manager_id ?? null,
      togglable:         true,    // demo rows: tier IS editable so you can preview each tier's UI
      staffTogglable:    !isDemo, // but admin/concierge/RM aren't meaningful on demo fixtures
      toggleReason:      undefined,
      staffToggleReason: isDemo ? 'Admin / Concierge / RM don\'t apply to demo accounts' : undefined,
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

        <details className="glass-panel group">
          <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between gap-4 select-none">
            <div>
              <h2 className="font-display text-base text-ee-primary">Setup &amp; maintenance</h2>
              <p className="text-xs text-ee-muted mt-0.5">
                Demo data seeders and one-off operational utilities.
              </p>
            </div>
            <span className="material-symbols-outlined text-ee-muted transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2 space-y-3 border-t border-ee-border">
            <SeedDemoButton />
            <BackfillPlaceholdersButton />
          </div>
        </details>

        <details className="glass-panel group">
          <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between gap-4 select-none">
            <div>
              <h2 className="font-display text-base text-ee-primary">Events</h2>
              <p className="text-xs text-ee-muted mt-0.5">
                Create summits, roundtables, webinars, and showcases. Tier-gate via the Minimum tier field.
              </p>
            </div>
            <span className="material-symbols-outlined text-ee-muted transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2 border-t border-ee-border">
            <CreateEventForm existing={existingEventsForClient} />
          </div>
        </details>

        <details className="glass-panel group">
          <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between gap-4 select-none">
            <div>
              <h2 className="font-display text-base text-ee-primary">Investor preview links</h2>
              <p className="text-xs text-ee-muted mt-0.5">
                Mint a one-time link that lets a fundraising investor browse the platform as a demo profile. Read-only — all mutations are blocked.
              </p>
            </div>
            <span className="material-symbols-outlined text-ee-muted transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2 border-t border-ee-border">
            {demoProfiles.length === 0 ? (
              <p className="text-xs text-ee-muted">
                No demo profiles yet — run <strong>Seed demo data</strong> above first.
              </p>
            ) : (
              <PreviewTokensPanel demoProfiles={demoProfiles} />
            )}
          </div>
        </details>

        <details className="glass-panel group">
          <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between gap-4 select-none">
            <div>
              <h2 className="font-display text-base text-ee-primary">Pitch deck links</h2>
              <p className="text-xs text-ee-muted mt-0.5">
                Per-recipient links to the rendered pitch deck on this domain. Audit + revoke + expire — same mechanics as investor preview links.
              </p>
            </div>
            <span className="material-symbols-outlined text-ee-muted transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2 border-t border-ee-border">
            {demoProfiles.length === 0 ? (
              <p className="text-xs text-ee-muted">
                No demo profiles yet — run <strong>Seed demo data</strong> above first. Each deck mint requires a demo profile to power the paired preview link.
              </p>
            ) : (
              <DeckTokensPanel demoProfiles={demoProfiles} />
            )}
          </div>
        </details>

        {merged.length === 0 ? (
          <div className="glass-panel overflow-hidden">
            <div className="px-6 py-4 border-b border-ee-border">
              <h2 className="font-display text-base text-ee-primary">Members</h2>
            </div>
            <p className="px-6 py-10 text-center text-sm text-ee-muted">No members yet.</p>
          </div>
        ) : (
          <MembersTable rows={merged} selfUserId={userId} concierges={concierges} />
        )}

        {/* Managed accounts ─ reassignment */}
        {managedAccounts.length > 0 && (
          <div className="glass-panel overflow-hidden">
            <div className="px-6 py-4 border-b border-ee-border">
              <h2 className="font-display text-base text-ee-primary">Managed accounts</h2>
              <p className="text-xs text-ee-muted mt-1">
                Every profile currently assigned to a concierge. Change the assignment by picking a different concierge, or clear it to remove management.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
                  <th className="text-left px-6 py-3 font-normal">Account</th>
                  <th className="text-left px-6 py-3 font-normal">Role</th>
                  <th className="text-left px-6 py-3 font-normal">Email</th>
                  <th className="text-left px-6 py-3 font-normal">Assigned concierge</th>
                </tr>
              </thead>
              <tbody>
                {managedAccounts.map(m => (
                  <tr key={m.id} className="border-t border-ee-border/60">
                    <td className="px-6 py-3">
                      <p className="text-ee-primary">{m.full_name}</p>
                      <p className="text-xs text-ee-muted">{m.firm_name}</p>
                    </td>
                    <td className="px-6 py-3 text-ee-muted">
                      {m.role === 'angel' ? 'Angel' : 'Family Office'}
                    </td>
                    <td className="px-6 py-3 text-ee-muted truncate max-w-[14rem]">{m.email}</td>
                    <td className="px-6 py-3">
                      <ManagedAccountAssignment
                        accountId={m.id}
                        currentId={m.managed_by}
                        concierges={concierges}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-ee-muted text-center">
          Admin status is granted per-user. <code className="font-data">ADMIN_EMAILS</code> remains as a break-glass fallback so the initial admin can always sign in.
        </p>
      </div>
    </div>
  )
}

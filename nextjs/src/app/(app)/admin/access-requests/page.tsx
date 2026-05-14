import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import StatusButtons from './StatusButtons'

interface RequestRow {
  id: string
  email: string
  full_name: string
  firm_name: string
  role: 'angel' | 'family_office'
  notes: string | null
  status: 'new' | 'contacted' | 'invited' | 'declined'
  created_at: Date | string
}

const STATUS_STYLES: Record<RequestRow['status'], string> = {
  new:       'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
  contacted: 'border-ee-primary/30 bg-ee-primary/10 text-ee-primary',
  invited:   'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
  declined:  'border-ee-border    bg-white/5       text-ee-muted',
}

function relativeDate(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  const days = Math.floor((Date.now() - t.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AccessRequestsPage() {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')
  if (!(await isUserAdmin(userId, userEmail))) redirect('/dashboard')

  let requests: RequestRow[] = []
  try {
    requests = await query<RequestRow>(
      `SELECT id, email, full_name, firm_name, role, notes, status, created_at
       FROM access_requests
       ORDER BY
         CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END,
         created_at DESC`
    )
  } catch {
    // table not initialized yet — show empty state
  }

  const counts = {
    new:       requests.filter(r => r.status === 'new').length,
    contacted: requests.filter(r => r.status === 'contacted').length,
    invited:   requests.filter(r => r.status === 'invited').length,
    declined:  requests.filter(r => r.status === 'declined').length,
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Operations</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Access requests</h1>
          <p className="text-ee-muted text-sm mt-1">
            Submissions from <code className="font-data">/request-access</code> on the landing page.
            {requests.length > 0 && (
              <span> {counts.new} new · {counts.contacted} contacted · {counts.invited} invited · {counts.declined} declined</span>
            )}
          </p>
          <p className="text-xs text-ee-muted mt-2">
            <a href="/admin" className="hover:text-ee-primary">← Back to admin</a>
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center mx-auto mb-3">
              <span
                className="material-symbols-outlined text-ee-gold text-2xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
              >
                inbox
              </span>
            </div>
            <p className="text-ee-primary text-sm">No access requests yet.</p>
            <p className="text-xs text-ee-muted mt-2">
              When someone submits the form on <a className="text-ee-gold hover:underline" href="/request-access">/request-access</a>, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <article key={r.id} className="glass-panel p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                      <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">
                        {r.role === 'angel' ? 'Angel' : 'Family Office'}
                      </span>
                      <span className="text-xs text-ee-muted">{relativeDate(r.created_at)}</span>
                    </div>

                    <div>
                      <p className="font-display text-lg text-ee-primary">{r.full_name}</p>
                      <p className="text-xs text-ee-muted">
                        {r.firm_name} ·{' '}
                        <a href={`mailto:${r.email}`} className="hover:text-ee-gold">{r.email}</a>
                      </p>
                    </div>

                    {r.notes && (
                      <blockquote className="text-xs text-ee-muted italic border-l-2 border-ee-gold/40 pl-3 mt-2">
                        &ldquo;{r.notes}&rdquo;
                      </blockquote>
                    )}
                  </div>

                  <StatusButtons id={r.id} current={r.status} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

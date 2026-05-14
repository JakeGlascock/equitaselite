import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import RespondButtons from './RespondButtons'

interface IntroRow {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string | null
  created_at: string
  requester_name: string
  requester_firm: string
  requester_email: string
  recipient_name: string
  recipient_firm: string
  recipient_email: string
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusBadge(status: IntroRow['status']) {
  const styles = {
    pending:  'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
    accepted: 'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
    declined: 'border-ee-border     bg-white/5       text-ee-muted',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function ConnectionsPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/signin')

  const intros = await query<IntroRow>(
    `SELECT i.id, i.requester_id, i.recipient_id, i.status, i.message, i.created_at,
            rp.full_name AS requester_name, rp.firm_name AS requester_firm, rp.email AS requester_email,
            cp.full_name AS recipient_name, cp.firm_name AS recipient_firm, cp.email AS recipient_email
     FROM introductions i
     JOIN profiles rp ON rp.id = i.requester_id
     JOIN profiles cp ON cp.id = i.recipient_id
     WHERE i.requester_id = $1 OR i.recipient_id = $1
     ORDER BY
       CASE WHEN i.recipient_id = $1 AND i.status = 'pending' THEN 0
            WHEN i.status = 'pending'                          THEN 1
            WHEN i.status = 'accepted'                         THEN 2
            ELSE 3
       END,
       i.created_at DESC`,
    [userId]
  )

  const incoming = intros.filter(i => i.recipient_id === userId && i.status === 'pending')
  const outgoing = intros.filter(i => i.requester_id === userId && i.status === 'pending')
  const active   = intros.filter(i => i.status === 'accepted')
  const declined = intros.filter(i => i.status === 'declined')

  function Row({ i }: { i: IntroRow }) {
    const isIncoming = i.recipient_id === userId
    const them = isIncoming
      ? { name: i.requester_name, firm: i.requester_firm, email: i.requester_email }
      : { name: i.recipient_name, firm: i.recipient_firm, email: i.recipient_email }

    return (
      <div className="flex items-center gap-4 px-6 py-4 border-t border-ee-border/60">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ee-primary truncate">{them.name}</p>
          <p className="text-xs text-ee-muted truncate">
            {them.firm} · {fmtDate(i.created_at)}
            {!isIncoming && i.status === 'pending' && ' · You requested'}
          </p>
          {i.message && (
            <p className="text-xs text-ee-muted mt-1.5 italic truncate">&ldquo;{i.message}&rdquo;</p>
          )}
        </div>

        {isIncoming && i.status === 'pending' ? (
          <RespondButtons introId={i.id} />
        ) : i.status === 'accepted' ? (
          <a
            href={`mailto:${them.email}`}
            className="text-xs px-3 py-1.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 whitespace-nowrap"
          >
            Email {them.name.split(' ')[0]}
          </a>
        ) : (
          statusBadge(i.status)
        )}
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: IntroRow[] }) {
    if (items.length === 0) return null
    return (
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-3 border-b border-ee-border">
          <h2 className="font-display text-sm text-ee-primary">
            {title} <span className="text-ee-muted font-normal">({items.length})</span>
          </h2>
        </div>
        {items.map(i => <Row key={i.id} i={i} />)}
      </div>
    )
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Deal Room</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Connections</h1>
          <p className="text-ee-muted text-sm mt-1">Introduction requests and active conversations.</p>
        </div>

        {intros.length === 0 && (
          <div className="glass-panel p-10 text-center">
            <p className="text-ee-muted text-sm">
              No introductions yet. Browse your matches and request one from the dashboard.
            </p>
          </div>
        )}

        <Section title="Incoming requests" items={incoming} />
        <Section title="Awaiting response" items={outgoing} />
        <Section title="Active connections" items={active} />
        <Section title="Declined" items={declined} />
      </div>
    </div>
  )
}

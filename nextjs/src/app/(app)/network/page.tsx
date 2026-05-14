import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getMe } from '@/lib/matches'

interface ConnectionRow {
  id: string
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  role: 'angel' | 'family_office'
  sectors: string[]
  email: string
  status: 'accepted' | 'pending' | 'declined'
  responded_at: string | null
  direction: 'outgoing' | 'incoming'
}

export default async function NetworkPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/')

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  // Fetch every accepted introduction this user is part of, plus the other
  // party's profile data
  const connections = await query<ConnectionRow>(
    `SELECT
       p.id, p.full_name, p.title, p.firm_name, p.location, p.role,
       p.sectors, p.email,
       i.status, i.responded_at,
       CASE WHEN i.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM introductions i
     JOIN profiles p ON p.id = CASE WHEN i.requester_id = $1 THEN i.recipient_id ELSE i.requester_id END
     WHERE i.status = 'accepted' AND (i.requester_id = $1 OR i.recipient_id = $1)
     ORDER BY i.responded_at DESC NULLS LAST`,
    [userId]
  )

  // Group by sector overlap with the user
  const groups = new Map<string, ConnectionRow[]>()
  for (const c of connections) {
    const overlap = c.sectors.filter(s => me.sectors.includes(s))
    const key = overlap[0] ?? 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  const totalSectors = new Set<string>()
  connections.forEach(c => c.sectors.forEach(s => totalSectors.add(s)))

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Relationships</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Network</h1>
          <p className="text-ee-muted text-sm mt-1">
            {connections.length === 0
              ? 'You have no active connections yet. Request an introduction from the Dashboard or Discovery to start building your network.'
              : `${connections.length} active ${connections.length === 1 ? 'connection' : 'connections'} across ${totalSectors.size} ${totalSectors.size === 1 ? 'sector' : 'sectors'}.`}
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center mx-auto mb-3">
              <span
                className="material-symbols-outlined text-ee-gold text-2xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
              >
                group
              </span>
            </div>
            <p className="text-ee-primary text-sm">Your network grows as you accept introductions.</p>
            <a
              href="/dashboard"
              className="inline-block mt-3 text-xs text-ee-gold hover:underline"
            >
              Browse matches →
            </a>
          </div>
        ) : (
          sortedGroups.map(([sector, conns]) => (
            <div key={sector} className="glass-panel overflow-hidden">
              <div className="px-6 py-3 border-b border-ee-border flex items-center justify-between">
                <h2 className="font-display text-base text-ee-primary">
                  {sector} <span className="text-ee-muted font-normal">({conns.length})</span>
                </h2>
              </div>
              <div className="divide-y divide-ee-border/40">
                {conns.map(c => (
                  <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-ee-gold/20 border border-ee-gold/40 flex items-center justify-center shrink-0">
                      <span className="font-data text-sm font-bold text-ee-gold">
                        {c.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ee-primary truncate">{c.full_name}</p>
                      <p className="text-xs text-ee-muted truncate">
                        {c.title ? `${c.title} · ` : ''}{c.firm_name}
                        {c.location ? ` · ${c.location}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted hidden sm:inline">
                        {c.role === 'angel' ? 'Angel' : 'Family Office'}
                      </span>
                      <a
                        href={`mailto:${c.email}`}
                        className="text-xs px-3 py-1.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 whitespace-nowrap"
                      >
                        Email
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

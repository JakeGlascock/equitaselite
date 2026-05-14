import Link from 'next/link'
import { headers } from 'next/headers'
import { queryOne, query } from '@/lib/db'
import ConciergeForm from './ConciergeForm'
import OperateAsButton from './OperateAsButton'

interface ManagedRow {
  id: string
  email: string
  full_name: string
  firm_name: string
  role: 'angel' | 'family_office'
  sectors: string[]
  check_size_min: number
  check_size_max: number
  created_at: Date | string
}

const SERVICES = [
  {
    title: 'Bespoke introductions',
    desc:  'When you need to reach a specific firm or principal outside the platform, we make warm introductions through our network.',
    icon:  'handshake',
  },
  {
    title: 'Due diligence support',
    desc:  'Background checks, mandate verification, reference calls — we coordinate the workstreams while you focus on the deal.',
    icon:  'fact_check',
  },
  {
    title: 'Counterparty vetting',
    desc:  'Independent vetting of investors or founders not yet on the platform. Comes with a written summary and risk flags.',
    icon:  'verified_user',
  },
  {
    title: 'Market intelligence',
    desc:  'Targeted research on sectors, sub-sectors, or specific opportunities. Delivered as a memo within five business days.',
    icon:  'query_stats',
  },
]

function checkDisplay(min: number, max: number): string {
  const fmt = (v: number) => v >= 1 ? `$${v}M` : `$${v * 1000}K`
  return `${fmt(Number(min))}–${fmt(Number(max))}`
}

export default async function ConciergePage() {
  const h = await headers()
  const userId = h.get('x-user-id')

  // Check if the current user is a concierge — show them a different page
  let isConcierge = false
  if (userId) {
    try {
      const row = await queryOne<{ is_concierge: boolean }>(
        'SELECT is_concierge FROM profiles WHERE id = $1',
        [userId]
      )
      isConcierge = !!row?.is_concierge
    } catch { /* column doesn't exist yet */ }
  }

  if (isConcierge) {
    let managed: ManagedRow[] = []
    try {
      managed = await query<ManagedRow>(
        `SELECT id, email, full_name, firm_name, role, sectors,
                check_size_min, check_size_max, created_at
         FROM profiles
         WHERE managed_by = $1 AND onboarding_completed = TRUE
         ORDER BY created_at DESC`,
        [userId!]
      )
    } catch { /* column not yet created */ }

    const angels = managed.filter(m => m.role === 'angel').length
    const offices = managed.filter(m => m.role === 'family_office').length

    return (
      <div className="px-5 md:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">White-glove</p>
              <h1 className="font-display text-3xl text-ee-gold mt-1">Managed accounts</h1>
              <p className="text-ee-muted text-sm mt-1">
                {managed.length === 0
                  ? 'Create profiles on behalf of your clients. They become active on the platform immediately.'
                  : `${managed.length} managed ${managed.length === 1 ? 'account' : 'accounts'} · ${angels} angel${angels === 1 ? '' : 's'} · ${offices} family ${offices === 1 ? 'office' : 'offices'}`}
              </p>
            </div>
            <Link href="/concierge/new" className="btn-gold whitespace-nowrap">
              + New managed account
            </Link>
          </div>

          {managed.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center mx-auto mb-3">
                <span
                  className="material-symbols-outlined text-ee-gold text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
                >
                  person_add
                </span>
              </div>
              <p className="text-ee-primary text-sm">No managed accounts yet.</p>
              <p className="text-xs text-ee-muted mt-2">
                Click <strong className="text-ee-primary">+ New managed account</strong> to create a profile for an angel investor or family office on their behalf.
              </p>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden">
              <div className="px-6 py-3 border-b border-ee-border flex items-center justify-between">
                <h2 className="font-display text-sm text-ee-primary">Active accounts</h2>
                <span className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
                  {managed.length}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
                    <th className="text-left  px-6 py-3 font-normal">Name</th>
                    <th className="text-left  px-6 py-3 font-normal">Firm</th>
                    <th className="text-left  px-6 py-3 font-normal">Role</th>
                    <th className="text-left  px-6 py-3 font-normal">Check size</th>
                    <th className="text-left  px-6 py-3 font-normal">Top sectors</th>
                    <th className="text-right px-6 py-3 font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managed.map(m => (
                    <tr key={m.id} className="border-t border-ee-border/60">
                      <td className="px-6 py-3 text-ee-primary">
                        <p>{m.full_name}</p>
                        <p className="text-xs text-ee-muted">{m.email}</p>
                      </td>
                      <td className="px-6 py-3 text-ee-muted">{m.firm_name}</td>
                      <td className="px-6 py-3 text-ee-muted">
                        {m.role === 'angel' ? 'Angel' : 'Family Office'}
                      </td>
                      <td className="px-6 py-3 text-ee-muted font-data text-xs">
                        {checkDisplay(m.check_size_min, m.check_size_max)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.sectors.slice(0, 3).map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-ee-gold/10 border border-ee-gold/20 text-ee-gold">
                              {s}
                            </span>
                          ))}
                          {m.sectors.length > 3 && (
                            <span className="text-[10px] text-ee-muted">+{m.sectors.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                          <Link
                            href={`/concierge/edit/${m.id}`}
                            className="text-xs px-3 py-1.5 rounded-full border border-ee-border text-ee-muted hover:text-ee-primary hover:border-white/20 font-data uppercase tracking-wider"
                          >
                            Edit
                          </Link>
                          <OperateAsButton id={m.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-ee-muted text-center">
            Click <strong className="text-ee-emerald">Operate as →</strong> to switch into a managed account. The whole app reflects that profile&apos;s data while you act on their behalf — banner at the top lets you exit anytime.
          </p>
        </div>
      </div>
    )
  }

  // Non-concierge: the existing white-glove service page
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">White-glove</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Concierge</h1>
          <p className="text-ee-muted text-sm mt-1">
            A direct line to our team for what falls outside the platform&apos;s automated flow.
          </p>
        </div>

        <div className="glass-panel p-6 flex items-center gap-5 border-ee-gold/30">
          <div className="w-14 h-14 rounded-full bg-ee-gold/20 border border-ee-gold/40 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-ee-gold text-2xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
            >
              support_agent
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold mb-1">Your relationship manager</p>
            <p className="font-display text-lg text-ee-primary">Olivia Marchetti</p>
            <p className="text-xs text-ee-muted">Available 9am–6pm ET · responds within 4 business hours</p>
          </div>
          <a
            href="mailto:olivia@equitaselite.com"
            className="hidden sm:inline btn-ghost whitespace-nowrap"
          >
            Email Olivia
          </a>
        </div>

        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">What we handle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map(s => (
              <div key={s.title} className="glass-panel p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-ee-gold text-lg">{s.icon}</span>
                </div>
                <div>
                  <h3 className="font-display text-base text-ee-primary mb-1.5">{s.title}</h3>
                  <p className="text-xs text-ee-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">Submit a request</h2>
          <ConciergeForm />
        </section>
      </div>
    </div>
  )
}

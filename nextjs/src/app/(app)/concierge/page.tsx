import Link from 'next/link'
import { headers } from 'next/headers'
import { queryOne, query } from '@/lib/db'
import { getTier } from '@/lib/membership'
import { listBriefingsForRecipient } from '@/lib/portfolio-reports'
import { listAnnotationsForConcierge, type ConciergeAnnotation } from '@/lib/concierge'
import ConciergeForm from './ConciergeForm'
import OperateAsButton from './OperateAsButton'
import OnboardingQueue, { type QueueRow } from './OnboardingQueue'
import AnnotationsPanel, { type AnnotationRow, type CounterpartyOption } from './AnnotationsPanel'

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

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
    desc:  'Warm introductions made personally by your concierge to firms in her network — a relationship-driven path that runs alongside the platform’s match score, not a replacement for it.',
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

    // Onboarding queue: Select+ / Sovereign signups not yet welcomed.
    // Excludes managed accounts (those are created BY a concierge, so
    // they're already in good hands).
    interface QueueDbRow {
      id:         string
      email:      string
      full_name:  string
      firm_name:  string
      role:       'angel' | 'family_office'
      membership: 'select' | 'sovereign'
      created_at: Date | string
    }
    let queue: QueueRow[] = []
    try {
      const rows = await query<QueueDbRow>(
        `SELECT id, email, full_name, firm_name, role, membership,
                created_at
         FROM profiles
         WHERE membership IN ('select','sovereign')
           AND onboarding_completed = TRUE
           AND welcomed_at IS NULL
           AND managed_by IS NULL
           AND (is_concierge IS NULL OR is_concierge = FALSE)
         ORDER BY created_at DESC
         LIMIT 50`
      )
      queue = rows.map(r => ({
        ...r,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      }))
    } catch { /* welcomed_at column not yet migrated */ }

    const angels = managed.filter(m => m.role === 'angel').length
    const offices = managed.filter(m => m.role === 'family_office').length

    return (
      <div className="px-5 md:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Welcome queue floats to the top — Select+/Sovereign signups
              waiting for a personal welcome. */}
          {queue.length > 0 && <OnboardingQueue rows={queue} />}

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

          {/* Phase 7B — concierge annotations (Layer 2 substrate).
              Private notes on counterparties that drive Chelsea's
              downstream actions without exposing her judgment to
              members. See feedback_two_trust_layers.md. */}
          <div className="pt-6 border-t border-ee-border">
            {await renderAnnotationsPanel(userId!)}
          </div>
        </div>
      </div>
    )
  }

  // Non-concierge: the white-glove service page.
  //
  // Four states for the lead card, in priority order:
  //   1. Caller has a relationship_manager_id set    → personalised RM card
  //   2. Caller is Sovereign but unassigned          → "RM being assigned" + Request tool
  //   3. Caller is Select                             → upsell to Sovereign + Request tool
  //   4. Caller is Access / no tier                   → upsell only (no Request tool)
  let assignedRm: { full_name: string; email: string } | null = null
  if (userId) {
    try {
      const rm = await queryOne<{ full_name: string; email: string }>(
        `SELECT rm.full_name, rm.email
         FROM profiles me
         JOIN profiles rm ON rm.id = me.relationship_manager_id
         WHERE me.id = $1 AND rm.is_concierge = TRUE`,
        [userId]
      )
      if (rm) assignedRm = rm
    } catch { /* relationship_manager_id column not yet migrated */ }
  }

  // Resolve the "default" concierge contact — env-var driven so it doesn't
  // hardcode a specific person's name into the source. Falls back to a
  // generic concierge-team label if the configured user doesn't exist
  // yet (e.g. before they've been invited + flagged is_concierge).
  const DEFAULT_EMAIL = process.env.DEFAULT_CONCIERGE_EMAIL ?? 'chelsea@logictry.com'
  let defaultConcierge: { full_name: string; email: string; bio: string | null } | null = null
  try {
    defaultConcierge = await queryOne<{ full_name: string; email: string; bio: string | null }>(
      `SELECT full_name, email, bio FROM profiles
       WHERE LOWER(email) = LOWER($1) AND is_concierge = TRUE
       LIMIT 1`,
      [DEFAULT_EMAIL]
    )
  } catch { /* is_concierge or bio column missing */ }
  const teamName  = defaultConcierge?.full_name ?? 'the Equitas Elite concierge team'
  const teamEmail = defaultConcierge?.email     ?? DEFAULT_EMAIL
  const teamBio   = defaultConcierge?.bio       ?? null

  const tier = userId ? await getTier(userId) : 'access'

  // Sovereigns also get a personal briefings stream above the services
  // grid. Non-Sovereigns see nothing extra (an empty briefings list
  // returns [] from the lib, so the section renders only when there's
  // real content to display).
  const briefings = userId && tier === 'sovereign'
    ? await listBriefingsForRecipient(userId)
    : []

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

        {assignedRm ? (
          // 1. Has a real RM
          <RelationshipManagerCard
            kind="Your dedicated relationship manager"
            fullName={assignedRm.full_name}
            email={assignedRm.email}
          />
        ) : tier === 'sovereign' ? (
          // 2. Sovereign but unassigned — give them a real contact path
          <UnassignedSovereignCard teamName={teamName} teamEmail={teamEmail} />
        ) : tier === 'select' ? (
          // 3. Select — upsell + request tool
          <SelectUpsellCard teamName={teamName} teamEmail={teamEmail} />
        ) : (
          // 4. Access / no tier — upsell only
          <AccessUpsellCard />
        )}

        {teamBio && (
          <section>
            <h2 className="font-display text-xl text-ee-primary mb-4">Meet your concierge</h2>
            <div className="glass-panel p-6 md:p-7 flex flex-col sm:flex-row gap-5 sm:items-start">
              <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-ee-gold text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
                >
                  account_circle
                </span>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="font-display text-lg text-ee-primary">{teamName}</p>
                <p className="text-sm text-ee-muted leading-relaxed">{teamBio}</p>
              </div>
            </div>
          </section>
        )}

        {briefings.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-ee-primary mb-4">Your briefings</h2>
            <div className="space-y-3">
              {briefings.map(b => (
                <Link
                  key={b.id}
                  href={`/briefings/${b.id}`}
                  className="block glass-panel p-5 hover:border-ee-gold/40 transition-colors"
                >
                  <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted mb-1.5">
                    {fmtDate(b.published_at)}
                  </p>
                  <h3 className="font-display text-lg text-ee-primary mb-2">{b.title}</h3>
                  <p className="text-sm text-ee-muted leading-relaxed">{b.summary}</p>
                  <p className="text-[11px] font-data uppercase tracking-widest text-ee-gold mt-3">Read briefing →</p>
                </Link>
              ))}
            </div>
          </section>
        )}

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

// ─── Lead-card variants ──────────────────────────────────────────────────

function RelationshipManagerCard({
  kind, fullName, email,
}: { kind: string; fullName: string; email: string }) {
  const firstName = fullName.split(' ')[0]
  return (
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
        <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold mb-1">{kind}</p>
        <p className="font-display text-lg text-ee-primary">{fullName}</p>
        <p className="text-xs text-ee-muted">Available 9am–6pm ET · responds within 4 business hours</p>
      </div>
      <a
        href={`mailto:${email}`}
        className="hidden sm:inline btn-ghost whitespace-nowrap"
      >
        Email {firstName}
      </a>
    </div>
  )
}

function UnassignedSovereignCard({ teamName, teamEmail }: { teamName: string; teamEmail: string }) {
  return (
    <div className="glass-panel p-6 flex items-center gap-5 border-ee-emerald/30">
      <div className="w-14 h-14 rounded-full bg-ee-emerald/20 border border-ee-emerald/40 flex items-center justify-center shrink-0">
        <span
          className="material-symbols-outlined text-ee-emerald text-2xl"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
        >
          schedule
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-data text-[10px] uppercase tracking-widest text-ee-emerald mb-1">Sovereign · onboarding</p>
        <p className="font-display text-lg text-ee-primary">Your dedicated RM is being assigned</p>
        <p className="text-xs text-ee-muted">
          In the meantime, {teamName} is here for anything you need.
        </p>
      </div>
      <a
        href={`mailto:${teamEmail}?subject=${encodeURIComponent('Concierge request')}`}
        className="hidden sm:inline btn-gold whitespace-nowrap text-xs"
      >
        Contact team
      </a>
    </div>
  )
}

function SelectUpsellCard({ teamName, teamEmail }: { teamName: string; teamEmail: string }) {
  return (
    <div className="glass-panel p-6 md:p-7 border-ee-gold/30 space-y-4">
      <div className="flex items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-ee-gold text-2xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
          >
            workspace_premium
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">Select tier</p>
          <p className="font-display text-lg text-ee-primary">A dedicated concierge is a Sovereign benefit</p>
          <p className="text-sm text-ee-muted leading-relaxed">
            On Sovereign you&apos;re paired with a dedicated concierge — your human
            counterpart to the platform&apos;s match algorithm. Where the score tells
            you whose mandate fits yours, the concierge tells you whom she&apos;s
            personally worked with and brokers the warm intro. Reach out to {teamName} below
            to explore the upgrade or request a one-off engagement.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <a
          href={`mailto:${teamEmail}?subject=${encodeURIComponent('Concierge request — Select member')}`}
          className="btn-ghost text-xs whitespace-nowrap"
        >
          Request concierge support
        </a>
        <Link href="/pricing" className="btn-gold text-xs whitespace-nowrap">
          Upgrade to Sovereign →
        </Link>
      </div>
    </div>
  )
}

function AccessUpsellCard() {
  return (
    <div className="glass-panel p-6 md:p-7 border-ee-gold/30 space-y-4">
      <div className="flex items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-ee-gold text-2xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
          >
            lock
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">Sovereign benefit</p>
          <p className="font-display text-lg text-ee-primary">Sovereign adds a second trust signal</p>
          <p className="text-sm text-ee-muted leading-relaxed">
            Every member gets the platform&apos;s mandate-match algorithm. Sovereign adds
            a dedicated concierge alongside it — a human relationship layer that runs
            parallel to the match score, not on top of it. The algorithm tells you whose
            mandate fits yours; the concierge tells you whom she&apos;d personally vouch for.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Link href="/pricing" className="btn-gold text-xs whitespace-nowrap">
          Upgrade to Sovereign →
        </Link>
      </div>
    </div>
  )
}

// Server-side helper for the concierge-only branch above. Fetches the
// concierge's existing annotations + the pool of counterparties they
// can annotate, then mounts the client AnnotationsPanel. Falls back to
// rendering nothing on any error so the rest of the concierge page
// stays usable even if the Phase 7B tables aren't yet migrated.
async function renderAnnotationsPanel(conciergeId: string) {
  try {
    const annotations = await listAnnotationsForConcierge(conciergeId)
    // Counterparty pool: every onboarded real member, plus demo profiles
    // so Chelsea can dogfood the flow pre-launch. Excludes concierges
    // (they can't be subjects of their own annotation table) and any
    // managed-account placeholders (those are profile-shells without a
    // real human counterparty behind them).
    const counterparties = await query<CounterpartyOption>(
      `SELECT id, full_name, firm_name, role
       FROM profiles
       WHERE onboarding_completed = TRUE
         AND (is_concierge IS NULL OR is_concierge = FALSE)
         AND id != $1
         AND id NOT LIKE 'managed_%'
       ORDER BY full_name ASC
       LIMIT 500`,
      [conciergeId],
    )

    // Normalize DB shape (Date | string for updated_at) into the
    // string-only shape AnnotationsPanel expects.
    const rows: AnnotationRow[] = annotations.map((a: ConciergeAnnotation) => ({
      id:              a.id,
      counterparty_id: a.counterparty_id,
      note:            a.note,
      vouch_strength:  a.vouch_strength,
      visibility:      a.visibility,
      updated_at:      a.updated_at instanceof Date
        ? a.updated_at.toISOString()
        : String(a.updated_at),
    }))

    return <AnnotationsPanel initialAnnotations={rows} counterparties={counterparties} />
  } catch {
    return null
  }
}

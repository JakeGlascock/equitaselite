import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { getActingAsState } from '@/lib/acting-as'
import { computeMatchScore } from '@/lib/scoring'
import { checkIntroQuota } from '@/lib/membership'
import { isUserAdmin } from '@/lib/admin'
import { isProfileVisibleTo } from '@/lib/visibility'
import IntroActionClient from './IntroActionClient'

interface FullProfile {
  id:              string
  email:           string
  full_name:       string
  title:           string | null
  firm_name:       string
  location:        string | null
  aum:             string | null
  role:            'angel' | 'family_office'
  sectors:         string[]
  stages:          string[]
  geography:       string[]
  check_size_min:  number
  check_size_max: number
  risk_tolerance:  string | null
  expected_return: string | null
  timeline:        string | null
  mandate_type:    string | null
  concentration:   string | null
  onboarding_completed: boolean
  is_off_market?:           boolean | null
  relationship_manager_id?: string | null
}

interface IntroRow {
  id:           string
  status:       'pending' | 'accepted' | 'declined'
  message:      string | null
  direction:    'outgoing' | 'incoming'
  created_at:   Date
  responded_at: Date | null
  other_email:  string
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function checkDisplay(min: number, max: number): string {
  const fmt = (v: number) => v >= 1 ? `$${v}M` : `$${v * 1000}K`
  return `${fmt(Number(min))}–${fmt(Number(max))}`
}

function toScoring(p: FullProfile) {
  return {
    id:           p.id,
    email:        p.email,
    role:         p.role,
    firmName:     p.firm_name,
    aum:          p.aum ?? undefined,
    sectors:      p.sectors,
    stages:       p.stages,
    geography:    p.geography,
    checkSizeMin: Number(p.check_size_min),
    checkSizeMax: Number(p.check_size_max),
    createdAt:    '',
    updatedAt:    '',
    bio:          '',
    isVerified:   false,
  }
}

async function fetchProfile(id: string): Promise<FullProfile | null> {
  // Try with the migration-033 columns first; fall back if not migrated yet.
  try {
    return await queryOne<FullProfile>(
      `SELECT id, email, full_name, title, firm_name, location, aum, role,
              sectors, stages, geography, check_size_min, check_size_max,
              risk_tolerance, expected_return, timeline, mandate_type,
              concentration, onboarding_completed,
              is_off_market, relationship_manager_id
       FROM profiles WHERE id = $1`,
      [id]
    )
  } catch {
    return queryOne<FullProfile>(
      `SELECT id, email, full_name, title, firm_name, location, aum, role,
              sectors, stages, geography, check_size_min, check_size_max,
              risk_tolerance, expected_return, timeline, mandate_type,
              concentration, onboarding_completed
       FROM profiles WHERE id = $1`,
      [id]
    )
  }
}

const LABEL_COLOR: Record<'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Low Fit', string> = {
  'Strong Fit':   '#4edea3',
  'Good Fit':     '#e9c176',
  'Possible Fit': '#f59e0b',
  'Low Fit':      '#ef4444',
}

const RING_R = 56
const RING_C = 2 * Math.PI * RING_R

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const state = await getActingAsState()
  if (!state) redirect('/signin')

  const me = await fetchProfile(state.effectiveUserId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const candidate = await fetchProfile(id)
  if (!candidate || !candidate.onboarding_completed) notFound()
  // Privacy: you can only inspect counterparties on the opposite side of the
  // market. No browsing fellow-investor profiles or fellow-family-office profiles.
  if (candidate.role === me.role || candidate.id === me.id) notFound()
  // Demo viewers (investor preview walkthroughs) can only inspect demo
  // profiles. Mirrors the getCandidates() scope so a demo viewer who
  // guesses or pastes a real-user id still gets a 404.
  if (me.id.startsWith('demo_') && !candidate.id.startsWith('demo_')) notFound()

  // Off-Market visibility gate (migration 033). If the candidate has
  // flipped on Off-Market mode, only self / their RM / admins / accepted
  // connections can see them. Anyone else gets a 404 — same shape as the
  // demo-scope guard above, so a guessed or shared id doesn't leak
  // membership of the off-market segment.
  const viewerIsAdmin = await isUserAdmin(me.id, null)
  const visible = await isProfileVisibleTo(
    { viewerId: me.id, viewerIsAdmin },
    candidate,
  )
  if (!visible) notFound()

  const score = computeMatchScore(toScoring(me), toScoring(candidate))
  const color = LABEL_COLOR[score.label]
  const filled = (score.total / 100) * RING_C

  // Intro state between us — pick the row in either direction
  const intro = await queryOne<IntroRow>(
    `SELECT i.id, i.status, i.message,
            CASE WHEN i.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
            i.created_at, i.responded_at,
            CASE WHEN i.requester_id = $1 THEN cp.email ELSE rp.email END AS other_email
     FROM introductions i
     JOIN profiles rp ON rp.id = i.requester_id
     JOIN profiles cp ON cp.id = i.recipient_id
     WHERE (i.requester_id = $1 AND i.recipient_id = $2)
        OR (i.requester_id = $2 AND i.recipient_id = $1)
     LIMIT 1`,
    [me.id, candidate.id]
  )

  const quota = await checkIntroQuota(me.id)
  const firstName = candidate.full_name.split(' ')[0]
  const isAngel = candidate.role === 'angel'

  // Timeline events
  const timeline: { at: Date; label: string; tone: 'neutral' | 'gold' | 'emerald' | 'red' }[] = []
  if (intro) {
    timeline.push({
      at:   intro.created_at,
      label: intro.direction === 'outgoing'
        ? `You requested an introduction`
        : `${firstName} requested an introduction`,
      tone: 'gold',
    })
    if (intro.responded_at && intro.status === 'accepted') {
      timeline.push({
        at:   intro.responded_at,
        label: intro.direction === 'outgoing'
          ? `${firstName} accepted · contact email released`
          : `You accepted · contact email released`,
        tone: 'emerald',
      })
    }
    if (intro.responded_at && intro.status === 'declined') {
      timeline.push({
        at:   intro.responded_at,
        label: intro.direction === 'outgoing'
          ? `${firstName} declined`
          : `You declined`,
        tone: 'red',
      })
    }
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-ee-muted hover:text-ee-primary font-data uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to matches
        </Link>

        {/* Hero — score ring + identity + tier action */}
        <div className="glass-panel p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="relative flex items-center justify-center w-32 h-32 shrink-0 mx-auto md:mx-0">
            <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
              <circle cx="64" cy="64" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
              <circle
                cx="64" cy="64" r={RING_R}
                fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${filled} ${RING_C - filled}`}
              />
            </svg>
            <div className="absolute text-center">
              <p className="font-data text-3xl font-bold" style={{ color }}>{score.total}</p>
              <p className="text-[10px] text-ee-muted uppercase tracking-widest mt-0.5">match</p>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-display text-3xl text-ee-primary leading-tight">{candidate.full_name}</h1>
                <p className="text-sm text-ee-muted mt-1">
                  {candidate.title ? `${candidate.title} · ` : ''}{candidate.firm_name}
                </p>
                {candidate.location && (
                  <p className="text-xs text-ee-muted mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">place</span>
                    {candidate.location}
                  </p>
                )}
              </div>
              <span
                className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full border whitespace-nowrap"
                style={{ color, borderColor: color, background: `${color}18` }}
              >
                {score.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
                {isAngel ? 'Angel Investor' : 'Family Office'}
              </span>
              {candidate.aum && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
                  AUM {candidate.aum}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
                Check {checkDisplay(candidate.check_size_min, candidate.check_size_max)}
              </span>
              {candidate.risk_tolerance && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
                  {candidate.risk_tolerance} risk
                </span>
              )}
            </div>

            <div className="pt-3">
              <IntroActionClient
                recipientId={candidate.id}
                recipientFirstName={firstName}
                initial={{
                  status:       intro?.status ?? null,
                  direction:    intro?.direction ?? null,
                  contactEmail: intro?.status === 'accepted' ? intro.other_email : null,
                }}
                canSendIntros={quota.ok}
                viewerIsOffMarket={!!me.is_off_market}
              />
            </div>
          </div>
        </div>

        {/* Score breakdown — uses the legacy 4-row layout because the
            contextual hints (what overlaps, what doesn't) are more useful
            here than the 6-pillar bars on the dashboard. The hard-coded
            weight labels were removed in Phase 6 since each viewer now
            has their own mandate_weights and the old 40/30/20/10 split
            no longer reflects how scores are computed. */}
        <section className="glass-panel p-6 md:p-8 space-y-4">
          <h2 className="font-display text-xl text-ee-gold">Why this score</h2>
          <p className="text-xs text-ee-muted">
            Weighted against <strong className="text-ee-primary">your</strong> mandate.
            Adjust the pillar weights from <span className="font-data">/profile</span> to change how strongly each signal counts.
          </p>
          <div className="space-y-3">
            {[
              { label: 'Sector overlap',  value: score.sector,    hint: dim(candidate.sectors, me.sectors) },
              { label: 'Stage alignment', value: score.stage,     hint: dim(candidate.stages,  me.stages)  },
              { label: 'Check size',      value: score.checkSize, hint: `${checkDisplay(me.check_size_min, me.check_size_max)} vs ${checkDisplay(candidate.check_size_min, candidate.check_size_max)}` },
              { label: 'Geography',       value: score.geography, hint: dim(candidate.geography, me.geography) },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ee-primary">{row.label}</span>
                  <span className="font-data text-ee-muted">{row.value}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5">
                  <div
                    className="h-1.5 rounded-full bg-ee-gold/70 transition-all duration-700"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
                {row.hint && <p className="text-[10px] text-ee-muted mt-1 font-data">{row.hint}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Full mandate */}
        <section className="glass-panel p-6 md:p-8 space-y-5">
          <h2 className="font-display text-xl text-ee-gold">Mandate</h2>

          <ChipBlock label="Sectors" items={candidate.sectors} />
          <ChipBlock label="Stages" items={candidate.stages} />
          <ChipBlock label="Geography" items={candidate.geography} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ee-border/50">
            {isAngel ? (
              <>
                <KV label="Target return" value={candidate.expected_return} />
                <KV label="Investment horizon" value={candidate.timeline} />
              </>
            ) : (
              <>
                <KV label="Mandate type" value={candidate.mandate_type} />
                <KV label="Structure" value={candidate.concentration} />
              </>
            )}
          </div>
        </section>

        {/* Activity timeline */}
        {timeline.length > 0 && (
          <section className="glass-panel p-6 md:p-8">
            <h2 className="font-display text-xl text-ee-gold mb-4">Activity</h2>
            <ol className="space-y-3">
              {timeline.map((evt, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      evt.tone === 'emerald' ? 'bg-ee-emerald'
                        : evt.tone === 'gold' ? 'bg-ee-gold'
                        : evt.tone === 'red'  ? 'bg-red-400'
                        : 'bg-ee-muted'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ee-primary">{evt.label}</p>
                    <p className="text-xs text-ee-muted font-data">
                      {fmtDate(evt.at)} · {fmtTime(evt.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {intro?.message && intro.direction === 'incoming' && (
              <div className="mt-5 pt-5 border-t border-ee-border/50">
                <p className="text-[10px] text-ee-muted font-data uppercase tracking-wider mb-1.5">
                  Their message
                </p>
                <blockquote className="text-sm text-ee-primary italic">&ldquo;{intro.message}&rdquo;</blockquote>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function ChipBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] text-ee-muted font-data uppercase tracking-wider mb-2">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-ee-muted italic">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(s => (
            <span key={s} className="px-2.5 py-1 rounded-full bg-ee-gold/10 border border-ee-gold/25 text-xs text-ee-gold">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function KV({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] text-ee-muted font-data uppercase tracking-wider">{label}</p>
      <p className="text-sm text-ee-primary mt-1">{value || <span className="text-ee-muted italic">—</span>}</p>
    </div>
  )
}

// Tiny pretty-print for the score breakdown hints
function dim(a: string[], b: string[]): string {
  const set = new Set(b)
  const overlap = a.filter(x => set.has(x))
  if (overlap.length === 0) return 'No overlap'
  if (overlap.length === a.length && overlap.length === b.length) return 'Full overlap'
  return `${overlap.length} shared (${overlap.slice(0, 3).join(', ')}${overlap.length > 3 ? '…' : ''})`
}


import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { computeMatchScore } from '@/lib/scoring'
import MatchCard, { type IntroState } from './MatchCard'

interface IntroRow {
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined'
  requester_email: string
  recipient_email: string
}

interface DbProfile {
  id: string
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  aum: string | null
  role: 'angel' | 'family_office'
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  onboarding_completed: boolean
}

function toScoring(p: DbProfile) {
  return {
    id:           p.id,
    email:        '',
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

export default async function DashboardPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/')

  const me = await queryOne<DbProfile>(
    `SELECT id, full_name, title, firm_name, location, aum, role,
            sectors, stages, geography, check_size_min, check_size_max,
            onboarding_completed
     FROM profiles WHERE id = $1`,
    [userId]
  )

  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const oppositeRole = me.role === 'angel' ? 'family_office' : 'angel'
  const candidates = await query<DbProfile>(
    `SELECT id, full_name, title, firm_name, location, aum, role,
            sectors, stages, geography, check_size_min, check_size_max,
            onboarding_completed
     FROM profiles
     WHERE role = $1 AND onboarding_completed = TRUE AND id != $2`,
    [oppositeRole, userId]
  )

  const intros = await query<IntroRow>(
    `SELECT i.requester_id, i.recipient_id, i.status,
            rp.email AS requester_email, cp.email AS recipient_email
     FROM introductions i
     JOIN profiles rp ON rp.id = i.requester_id
     JOIN profiles cp ON cp.id = i.recipient_id
     WHERE i.requester_id = $1 OR i.recipient_id = $1`,
    [userId]
  )

  const introByOtherId = new Map<string, IntroState>()
  for (const i of intros) {
    const isOutgoing = i.requester_id === userId
    const otherId    = isOutgoing ? i.recipient_id : i.requester_id
    introByOtherId.set(otherId, {
      status:       i.status,
      direction:    isOutgoing ? 'outgoing' : 'incoming',
      contactEmail: i.status === 'accepted'
        ? (isOutgoing ? i.recipient_email : i.requester_email)
        : null,
    })
  }

  const matches = candidates
    .map(c => ({
      id:           c.id,
      fullName:     c.full_name,
      title:        c.title,
      firmName:     c.firm_name,
      location:     c.location,
      aum:          c.aum,
      role:         c.role,
      sectors:      c.sectors,
      stages:       c.stages,
      geography:    c.geography,
      checkSizeMin: Number(c.check_size_min),
      checkSizeMax: Number(c.check_size_max),
      score:        computeMatchScore(toScoring(me), toScoring(c)),
      intro:        introByOtherId.get(c.id) ?? {
        status: null, direction: null, contactEmail: null,
      } satisfies IntroState,
    }))
    .sort((a, b) => b.score.total - a.score.total)

  const pendingIncoming = intros.filter(i => i.recipient_id === userId && i.status === 'pending').length

  const firstName = me.full_name.split(' ')[0]
  const roleLabel = me.role === 'angel' ? 'Family Offices' : 'Angel Investors'

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Executive Overview</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Welcome back, {firstName}</h1>
          <p className="text-ee-muted text-sm mt-1">
            {matches.length > 0
              ? `${matches.length} ${roleLabel} matched to your mandate · ${pendingIncoming} pending request${pendingIncoming === 1 ? '' : 's'}`
              : `No ${roleLabel} have completed their profiles yet`}
          </p>
        </div>

        {/* Match list */}
        {matches.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <p className="text-ee-muted text-sm">
              Check back soon — we&apos;re onboarding {roleLabel.toLowerCase()} now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

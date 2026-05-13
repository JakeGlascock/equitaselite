import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { computeMatchScore } from '@/lib/scoring'
import MatchCard from './MatchCard'

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
    }))
    .sort((a, b) => b.score.total - a.score.total)

  const firstName = me.full_name.split(' ')[0]
  const roleLabel = me.role === 'angel' ? 'Family Offices' : 'Angel Investors'

  const userEmail = headersList.get('x-user-email')?.toLowerCase()
  const isAdmin = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    .includes(userEmail ?? '')

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl text-ee-gold">Welcome back, {firstName}</h1>
            <p className="text-ee-muted text-sm mt-0.5">
              {matches.length > 0
                ? `${matches.length} ${roleLabel} matched to your mandate`
                : `No ${roleLabel} have completed their profiles yet`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <a href="/admin" className="text-xs text-ee-gold hover:brightness-110 transition-all">
                Admin
              </a>
            )}
            <a href="/profile" className="text-xs text-ee-muted hover:text-ee-primary transition-colors">
              Edit profile
            </a>
            <a href="/api/auth/signout" className="text-xs text-ee-muted hover:text-ee-primary transition-colors">
              Sign out
            </a>
          </div>
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
    </main>
  )
}

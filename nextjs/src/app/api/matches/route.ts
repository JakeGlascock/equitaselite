import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { computeMatchScore } from '@/lib/scoring'

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
}

function toScoring(p: DbProfile) {
  return {
    id:           p.id,
    role:         p.role,
    firmName:     p.firm_name,
    aum:          p.aum ?? undefined,
    sectors:      p.sectors,
    stages:       p.stages,
    geography:    p.geography,
    checkSizeMin: Number(p.check_size_min),
    checkSizeMax: Number(p.check_size_max),
    // Candidate-required fields not used in scoring
    bio:         '',
    isVerified:  false,
  }
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await queryOne<DbProfile>(
    `SELECT id, full_name, title, firm_name, location, aum, role,
            sectors, stages, geography, check_size_min, check_size_max
     FROM profiles WHERE id = $1 AND onboarding_completed = TRUE`,
    [userId]
  )
  if (!me) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const oppositeRole = me.role === 'angel' ? 'family_office' : 'angel'
  const candidates = await query<DbProfile>(
    `SELECT id, full_name, title, firm_name, location, aum, role,
            sectors, stages, geography, check_size_min, check_size_max
     FROM profiles
     WHERE role = $1 AND onboarding_completed = TRUE AND id != $2`,
    [oppositeRole, userId]
  )

  const meScoring = {
    ...toScoring(me),
    email:     '',
    createdAt: '',
    updatedAt: '',
  }

  const results = candidates
    .map(c => ({
      id:       c.id,
      fullName: c.full_name,
      title:    c.title,
      firmName: c.firm_name,
      location: c.location,
      aum:      c.aum,
      role:     c.role,
      sectors:  c.sectors,
      stages:   c.stages,
      geography: c.geography,
      checkSizeMin: Number(c.check_size_min),
      checkSizeMax: Number(c.check_size_max),
      score: computeMatchScore(meScoring, toScoring(c)),
    }))
    .sort((a, b) => b.score.total - a.score.total)

  return NextResponse.json(results)
}

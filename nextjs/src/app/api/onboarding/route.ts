import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

const OnboardingSchema = z.object({
  email:            z.string().email(),
  role:             z.enum(['angel', 'family_office']),
  full_name:        z.string().min(1),
  title:            z.string().optional(),
  firm_name:        z.string().min(1),
  location:         z.string().optional(),
  aum:              z.string().optional(),
  sectors:          z.array(z.string()).default([]),
  stages:           z.array(z.string()).default([]),
  geography:        z.array(z.string()).default([]),
  check_size_min:   z.number().min(0).default(0),
  check_size_max:   z.number().min(0).default(0),
  risk_tolerance:   z.enum(['Conservative', 'Moderate', 'Aggressive']).optional(),
  expected_return:  z.string().optional(),
  timeline:         z.string().optional(),
  mandate_type:     z.string().optional(),
  concentration:    z.string().optional(),
})

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const profile = await queryOne(
    `INSERT INTO profiles (
       id, email, role, full_name, title, firm_name, location, aum,
       sectors, stages, geography,
       check_size_min, check_size_max, risk_tolerance,
       expected_return, timeline, mandate_type, concentration,
       onboarding_completed
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       $9,$10,$11,
       $12,$13,$14,
       $15,$16,$17,$18,
       TRUE
     )
     ON CONFLICT (id) DO UPDATE SET
       email=$2, role=$3, full_name=$4, title=$5, firm_name=$6,
       location=$7, aum=$8,
       sectors=$9, stages=$10, geography=$11,
       check_size_min=$12, check_size_max=$13, risk_tolerance=$14,
       expected_return=$15, timeline=$16, mandate_type=$17, concentration=$18,
       onboarding_completed=TRUE
     RETURNING *`,
    [
      userId, d.email, d.role, d.full_name, d.title ?? null,
      d.firm_name, d.location ?? null, d.aum ?? null,
      d.sectors, d.stages, d.geography,
      d.check_size_min, d.check_size_max, d.risk_tolerance ?? null,
      d.expected_return ?? null, d.timeline ?? null,
      d.mandate_type ?? null, d.concentration ?? null,
    ]
  )

  return NextResponse.json(profile, { status: 201 })
}

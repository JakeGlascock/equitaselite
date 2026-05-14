import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'

const OnboardingSchema = z.object({
  email:            z.string().email(),
  role:             z.enum(['angel', 'family_office']),
  full_name:        z.string().trim().min(2).max(120),
  title:            z.string().trim().max(120).optional(),
  firm_name:        z.string().trim().min(2).max(160),
  location:         z.string().trim().max(120).optional(),
  aum:              z.string().trim().max(40).optional(),
  sectors:          z.array(z.string()).min(1),
  stages:           z.array(z.string()).min(1),
  geography:        z.array(z.string()).min(1),
  check_size_min:   z.number().positive(),
  check_size_max:   z.number().positive(),
  risk_tolerance:   z.enum(['Conservative', 'Moderate', 'Aggressive']),
  expected_return:  z.string().optional(),
  timeline:         z.string().optional(),
  mandate_type:     z.string().optional(),
  concentration:    z.string().optional(),
  email_notifications_enabled: z.boolean().optional(),
}).superRefine((d, ctx) => {
  if (d.check_size_max < d.check_size_min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['check_size_max'],
      message: 'Maximum check size must be at least the minimum.',
    })
  }
  if (d.role === 'family_office') {
    if (!d.aum) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aum'], message: 'AUM is required for family offices.' })
    }
    if (!d.mandate_type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mandate_type'], message: 'Mandate type is required.' })
    }
    if (!d.concentration) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['concentration'], message: 'Deal structure preference is required.' })
    }
  }
  if (d.role === 'angel') {
    if (!d.expected_return) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expected_return'], message: 'Target return multiple is required.' })
    }
    if (!d.timeline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline'], message: 'Investment horizon is required.' })
    }
  }
})

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first.path.length ? `${first.path.join('.')}: ` : ''
    return NextResponse.json(
      { error: `${where}${first.message}`, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const d = parsed.data
  const emailPref = d.email_notifications_enabled ?? true
  const profile = await queryOne(
    `INSERT INTO profiles (
       id, email, role, full_name, title, firm_name, location, aum,
       sectors, stages, geography,
       check_size_min, check_size_max, risk_tolerance,
       expected_return, timeline, mandate_type, concentration,
       email_notifications_enabled,
       onboarding_completed
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       $9,$10,$11,
       $12,$13,$14,
       $15,$16,$17,$18,
       $19,
       TRUE
     )
     ON CONFLICT (id) DO UPDATE SET
       email=$2, role=$3, full_name=$4, title=$5, firm_name=$6,
       location=$7, aum=$8,
       sectors=$9, stages=$10, geography=$11,
       check_size_min=$12, check_size_max=$13, risk_tolerance=$14,
       expected_return=$15, timeline=$16, mandate_type=$17, concentration=$18,
       email_notifications_enabled=$19,
       onboarding_completed=TRUE
     RETURNING *`,
    [
      userId, d.email, d.role, d.full_name, d.title ?? null,
      d.firm_name, d.location ?? null, d.aum ?? null,
      d.sectors, d.stages, d.geography,
      d.check_size_min, d.check_size_max, d.risk_tolerance ?? null,
      d.expected_return ?? null, d.timeline ?? null,
      d.mandate_type ?? null, d.concentration ?? null,
      emailPref,
    ]
  )

  return NextResponse.json(profile, { status: 201 })
}

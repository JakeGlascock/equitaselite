import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { query, queryOne } from '@/lib/db'

async function isCallerConcierge(userId: string | null): Promise<boolean> {
  if (!userId) return false
  try {
    const row = await queryOne<{ is_concierge: boolean }>(
      'SELECT is_concierge FROM profiles WHERE id = $1',
      [userId]
    )
    return !!row?.is_concierge
  } catch {
    return false
  }
}

const CreateSchema = z.object({
  email:           z.string().email(),
  full_name:       z.string().min(1),
  title:           z.string().optional(),
  firm_name:       z.string().min(1),
  location:        z.string().optional(),
  aum:             z.string().optional(),
  role:            z.enum(['angel', 'family_office']),
  sectors:         z.array(z.string()).default([]),
  stages:          z.array(z.string()).default([]),
  geography:       z.array(z.string()).default([]),
  check_size_min:  z.number().min(0).default(0),
  check_size_max:  z.number().min(0).default(0),
  risk_tolerance:  z.enum(['Conservative', 'Moderate', 'Aggressive']).optional(),
  expected_return: z.string().optional(),
  timeline:        z.string().optional(),
  mandate_type:    z.string().optional(),
  concentration:   z.string().optional(),
})

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!(await isCallerConcierge(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await query(
    `SELECT id, email, full_name, firm_name, role, sectors, stages,
            check_size_min, check_size_max, created_at
     FROM profiles
     WHERE managed_by = $1 AND onboarding_completed = TRUE
     ORDER BY created_at DESC`,
    [userId]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!(await isCallerConcierge(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d  = parsed.data
  const id = `managed_${randomUUID()}`

  try {
    const profile = await queryOne(
      `INSERT INTO profiles (
         id, email, role, full_name, title, firm_name, location, aum,
         sectors, stages, geography,
         check_size_min, check_size_max, risk_tolerance,
         expected_return, timeline, mandate_type, concentration,
         onboarding_completed, managed_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,
         $12,$13,$14,
         $15,$16,$17,$18,
         TRUE, $19
       )
       RETURNING *`,
      [
        id, d.email, d.role, d.full_name, d.title ?? null,
        d.firm_name, d.location ?? null, d.aum ?? null,
        d.sectors, d.stages, d.geography,
        d.check_size_min, d.check_size_max, d.risk_tolerance ?? null,
        d.expected_return ?? null, d.timeline ?? null,
        d.mandate_type ?? null, d.concentration ?? null,
        userId,
      ]
    )
    return NextResponse.json(profile, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('profiles_email_key') || msg.toLowerCase().includes('unique')) {
      return NextResponse.json({ error: 'A profile with this email already exists on the platform.' }, { status: 409 })
    }
    console.error('concierge create profile failed:', err)
    return NextResponse.json({ error: msg || 'Failed' }, { status: 500 })
  }
}

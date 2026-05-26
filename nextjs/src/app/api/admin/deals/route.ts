import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isUserAdmin } from '@/lib/admin'
import { createDeal, listAllDeals } from '@/lib/deals'

const CreateSchema = z.object({
  title:          z.string().trim().min(3).max(200),
  description:    z.string().trim().min(20).max(50000),
  sectors:        z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  stages:         z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  check_size_min: z.number().int().nonnegative().nullable().optional(),
  check_size_max: z.number().int().nonnegative().nullable().optional(),
  geography:      z.string().trim().max(120).nullable().optional(),
  expires_at:     z.string().datetime().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }
  const deal = await createDeal({ ...parsed.data, created_by: adminId! })
  return NextResponse.json({ deal }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const adminId    = req.headers.get('x-user-id')
  const adminEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(adminId, adminEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const deals = await listAllDeals().catch(() => [])
  return NextResponse.json({ deals })
}

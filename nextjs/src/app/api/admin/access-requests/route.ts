import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await query(
      `SELECT id, email, full_name, firm_name, role, notes, status,
              created_at, handled_at, handled_by
       FROM access_requests
       ORDER BY
         CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END,
         created_at DESC`
    )
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

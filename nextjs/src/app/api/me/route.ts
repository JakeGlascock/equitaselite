import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await queryOne(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  )

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(profile)
}

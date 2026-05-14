import { NextResponse } from 'next/server'
import { ACTING_AS_COOKIE } from '@/lib/acting-as'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(ACTING_AS_COOKIE)
  return res
}

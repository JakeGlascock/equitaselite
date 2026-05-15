import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { PREVIEW_COOKIE_NAME } from '@/lib/preview'

// POST /api/preview/clear — log out of the investor preview. Idempotent.
// Public route (the visitor doesn't have a real session to lose), but
// it does nothing unless the ee_preview cookie is set.
export async function POST() {
  const jar = await cookies()
  jar.delete(PREVIEW_COOKIE_NAME)
  return NextResponse.json({ ok: true })
}

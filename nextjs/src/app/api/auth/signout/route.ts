import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('ee_access')?.value

  if (accessToken) {
    try {
      await signOut(accessToken)
    } catch {
      // Proceed even if Cognito revocation fails — token may already be expired
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('ee_access')
  res.cookies.delete('ee_id')
  res.cookies.delete('ee_refresh')
  return res
}

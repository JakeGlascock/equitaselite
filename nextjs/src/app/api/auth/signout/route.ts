import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'
import { publicUrl } from '@/lib/public-url'

async function clearSession(req: NextRequest, redirectTo: string | null) {
  const accessToken = req.cookies.get('ee_access')?.value
  if (accessToken) {
    try { await signOut(accessToken) } catch { /* expired token is fine */ }
  }
  const res = redirectTo
    ? NextResponse.redirect(publicUrl(req, redirectTo))
    : NextResponse.json({ ok: true })
  // Only the session cookies are cleared. The four ee_device_* cookies
  // (key, group, password, user) survive: the user explicitly opted to
  // trust this device for 30 days, and explicit signout means "drop the
  // session," not "untrust the hardware." Next signin from the same
  // browser will route through signInWithDevice and skip MFA. A user
  // who wants to drop trust will use a future "Forget this device"
  // affordance, not signout.
  res.cookies.delete('ee_access')
  res.cookies.delete('ee_id')
  res.cookies.delete('ee_refresh')
  return res
}

export async function GET(req: NextRequest) {
  return clearSession(req, '/')
}

export async function POST(req: NextRequest) {
  return clearSession(req, null)
}

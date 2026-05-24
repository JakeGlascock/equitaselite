import { NextRequest, NextResponse } from 'next/server'
import { signOut, forgetDevice } from '@/lib/auth'
import { publicUrl } from '@/lib/public-url'

async function clearSession(req: NextRequest, redirectTo: string | null) {
  const accessToken = req.cookies.get('ee_access')?.value
  const deviceKey   = req.cookies.get('ee_device_key')?.value
  // Explicit signout = clean break. Forget the device on Cognito so the
  // entry doesn't accumulate, then clear the local device cookies. Next
  // signin starts a fresh MFA pair.
  if (accessToken) {
    if (deviceKey) {
      try { await forgetDevice(accessToken, deviceKey) } catch { /* already gone is fine */ }
    }
    try { await signOut(accessToken) } catch { /* expired token is fine */ }
  }
  const res = redirectTo
    ? NextResponse.redirect(publicUrl(req, redirectTo))
    : NextResponse.json({ ok: true })
  res.cookies.delete('ee_access')
  res.cookies.delete('ee_id')
  res.cookies.delete('ee_refresh')
  res.cookies.delete('ee_device_key')
  res.cookies.delete('ee_device_group')
  res.cookies.delete('ee_device_password')
  res.cookies.delete('ee_device_user')
  return res
}

export async function GET(req: NextRequest) {
  return clearSession(req, '/')
}

export async function POST(req: NextRequest) {
  return clearSession(req, null)
}

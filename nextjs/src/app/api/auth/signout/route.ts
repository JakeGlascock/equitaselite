import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

async function clearSession(req: NextRequest, redirectTo: string | null) {
  const accessToken = req.cookies.get('ee_access')?.value
  if (accessToken) {
    try { await signOut(accessToken) } catch { /* expired token is fine */ }
  }
  const res = redirectTo
    ? NextResponse.redirect(new URL(redirectTo, req.url))
    : NextResponse.json({ ok: true })
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

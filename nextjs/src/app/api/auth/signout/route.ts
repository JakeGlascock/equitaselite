import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

// In an ECS task behind an ALB, req.url's host is the container's internal
// hostname (ip-10-0-X-Y.ec2.internal:3000), not equitaselite.com. The ALB
// adds x-forwarded-host / x-forwarded-proto with the real public values —
// use those so the redirect Location points at the public site.
function publicUrl(req: NextRequest, path: string): URL {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host')
             ?? req.headers.get('host')
             ?? 'equitaselite.com'
  return new URL(path, `${proto}://${host}`)
}

async function clearSession(req: NextRequest, redirectTo: string | null) {
  const accessToken = req.cookies.get('ee_access')?.value
  if (accessToken) {
    try { await signOut(accessToken) } catch { /* expired token is fine */ }
  }
  const res = redirectTo
    ? NextResponse.redirect(publicUrl(req, redirectTo))
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

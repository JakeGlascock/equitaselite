import type { NextRequest } from 'next/server'

// In an ECS task behind an ALB, req.url's host is the container's internal
// hostname (ip-10-0-X-Y.ec2.internal:3000), not equitaselite.com. The ALB
// adds x-forwarded-host and x-forwarded-proto with the real public values —
// use those so any Location header points at the public site.
//
// Node-runtime route handlers need this. Edge-runtime middleware does not
// (the framework reconstructs req.url from X-Forwarded-* there).
export function publicUrl(req: NextRequest, path: string): URL {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host')
             ?? req.headers.get('host')
             ?? 'equitaselite.com'
  return new URL(path, `${proto}://${host}`)
}

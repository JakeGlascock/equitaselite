// Cloudflare Turnstile verification (Phase F demo signup).
// Anti-scraper invisible CAPTCHA. If TURNSTILE_SECRET_KEY isn't set
// (local dev / not-yet-configured environments), the verify function
// logs a warning and returns true — so development isn't blocked by
// missing infra config. Production deployments MUST set the secret.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY not set — skipping Turnstile verification. Set the env var in production.')
    return true
  }
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body })
    if (!res.ok) return false
    const data = await res.json() as { success?: boolean }
    return !!data.success
  } catch (err) {
    console.error('Turnstile verify failed:', err)
    return false
  }
}

// Site key is safe to expose to the client. Wrapped here so callers
// don't have to repeat the env-var reach.
export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// The 5-field public demo signup form. Submits to /api/demo/signup;
// on success bounces to /try/check-email. Turnstile widget mounts via
// the Cloudflare script if NEXT_PUBLIC_TURNSTILE_SITE_KEY is set;
// otherwise the form submits without a token (the server skips
// verification when TURNSTILE_SECRET_KEY isn't set either).

const AUM_OPTIONS = ['<$10M', '$10M–$50M', '$50M–$250M', '$250M–$1B', '>$1B'] as const
const USE_OPTIONS = [
  'Learning about LPs',
  'Actively allocating',
  'Evaluating for our family office',
  'Just curious',
] as const
const ROLE_OPTIONS = [
  { value: 'angel',             label: 'Angel Investor' },
  { value: 'family_office',     label: 'Family Office' },
  { value: 'next_gen',          label: 'Next Gen' },
  { value: 'family_foundation', label: 'Family Foundation' },
  { value: 'daf',               label: 'DAF (Donor-Advised Fund)' },
] as const

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, opts: {
        sitekey:  string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
        theme?: 'dark' | 'light' | 'auto'
      }) => string
      reset:  (widgetId?: string) => void
    }
  }
}

export default function TryForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const router = useRouter()
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const widgetId  = useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const [fullName,      setFullName]     = useState('')
  const [email,         setEmail]        = useState('')
  const [firmName,      setFirmName]     = useState('')
  const [aumRange,      setAumRange]     = useState('')
  const [intendedUse,   setIntendedUse]  = useState('')
  const [viewingAsRole, setViewingAs]    = useState('')
  const [submitting, setSubmitting]      = useState(false)
  const [error, setError]                = useState('')

  // Lazy-load Turnstile script + mount the widget. Skipped if no site key.
  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return

    const ensureScript = (): Promise<void> => new Promise((resolve, reject) => {
      if (window.turnstile) return resolve()
      const existing = document.querySelector('script[data-turnstile]') as HTMLScriptElement | null
      if (existing) { existing.addEventListener('load', () => resolve()); return }
      const s = document.createElement('script')
      s.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true; s.defer = true
      s.dataset.turnstile = '1'
      s.onload  = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Turnstile'))
      document.head.appendChild(s)
    })

    let cancelled = false
    ensureScript().then(() => {
      if (cancelled || !window.turnstile || !widgetRef.current) return
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey:  turnstileSiteKey,
        theme:    'dark',
        callback: (t) => setTurnstileToken(t),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback':   () => setTurnstileToken(null),
      })
    }).catch(err => {
      console.warn('Turnstile script load failed:', err)
    })

    return () => { cancelled = true }
  }, [turnstileSiteKey])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName || !email || !firmName || !aumRange || !intendedUse || !viewingAsRole) {
      setError('Every field is required.')
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError('Anti-spam check is loading. Try again in a moment.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/demo/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:        fullName,
          email,
          firm_name:        firmName,
          aum_range:        aumRange,
          intended_use:     intendedUse,
          viewing_as_role:  viewingAsRole,
          turnstile_token:  turnstileToken ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Submission failed')
      // Pass the email through so the interstitial can show it.
      router.replace(`/try/check-email?to=${encodeURIComponent(email)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
      // Reset Turnstile so the user can retry.
      if (window.turnstile && widgetId.current) {
        try { window.turnstile.reset(widgetId.current) } catch { /* ignore */ }
        setTurnstileToken(null)
      }
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 space-y-4">
      <Field label="Full name" required>
        <input
          className="input-field"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          required
        />
      </Field>
      <Field label="Work email" required>
        <input
          className="input-field"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          required
        />
      </Field>
      <Field label="Firm or family office name" required>
        <input
          className="input-field"
          value={firmName}
          onChange={e => setFirmName(e.target.value)}
          maxLength={160}
          autoComplete="organization"
          required
        />
      </Field>
      <Field label="AUM range" required>
        <select
          className="input-field"
          value={aumRange}
          onChange={e => setAumRange(e.target.value)}
          required
        >
          <option value="">Select…</option>
          {AUM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="What brings you here?" required>
        <select
          className="input-field"
          value={intendedUse}
          onChange={e => setIntendedUse(e.target.value)}
          required
        >
          <option value="">Select…</option>
          {USE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="View the platform as" required>
        <select
          className="input-field"
          value={viewingAsRole}
          onChange={e => setViewingAs(e.target.value)}
          required
        >
          <option value="">Select…</option>
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      {turnstileSiteKey && (
        <div className="flex justify-center pt-2">
          <div ref={widgetRef} />
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full btn-gold disabled:opacity-50"
      >
        {submitting ? 'Sending magic link…' : 'Email me a walkthrough link'}
      </button>
    </form>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
        {label}{required && <span className="text-ee-gold/80 ml-0.5" aria-label="required">*</span>}
      </label>
      {children}
    </div>
  )
}

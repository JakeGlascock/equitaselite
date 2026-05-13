'use client'

import { useState } from 'react'

type Step = 'credentials' | 'mfa'

export default function LoginPage() {
  const [step, setStep]       = useState<Step>('credentials')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [session, setSession] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/signin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed')

      if (data.challenge === 'mfa') {
        setSession(data.session)
        setStep('mfa')
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/signin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code: mfaCode, session }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/logo.png" alt="Equitas Elite" className="h-44 w-auto rounded-xl" />
        </div>

        <div className="glass-panel p-8">
          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Welcome back</h1>
                <p className="text-ee-muted text-sm">Sign in to your Equitas Elite account</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@firm.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field"
                    placeholder="••••••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="text-center text-xs text-ee-muted">
                Access is by invitation only.{' '}
                <a href="mailto:access@equitaselite.com" className="text-ee-gold hover:underline">
                  Request access
                </a>
              </p>
              <p className="text-center text-xs text-ee-muted">
                <a href="/pricing" className="hover:text-ee-primary transition-colors">
                  View membership plans →
                </a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Two-factor verification</h1>
                <p className="text-ee-muted text-sm">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div>
                <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="input-field text-center text-2xl tracking-[0.5em]"
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Verifying…' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setMfaCode('') }}
                className="w-full text-center text-xs text-ee-muted hover:text-ee-primary"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

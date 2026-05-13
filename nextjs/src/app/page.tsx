'use client'

import { useState } from 'react'

type Step = 'credentials' | 'new_password' | 'mfa_setup' | 'mfa'

function formatSecret(s: string): string {
  return s.replace(/(.{4})/g, '$1 ').trim()
}

export default function LoginPage() {
  const [step, setStep]               = useState<Step>('credentials')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [secretCode, setSecretCode]   = useState('')
  const [setupCode, setSetupCode]     = useState('')
  const [mfaCode, setMfaCode]         = useState('')
  const [session, setSession]         = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  function handleChallenge(data: { challenge?: string; session?: string; secretCode?: string }) {
    if (data.challenge === 'new_password') {
      setSession(data.session!); setStep('new_password')
    } else if (data.challenge === 'mfa_setup') {
      setSession(data.session!); setSecretCode(data.secretCode!); setStep('mfa_setup')
    } else if (data.challenge === 'mfa') {
      setSession(data.session!); setStep('mfa')
    } else {
      window.location.href = '/dashboard'
    }
  }

  async function postSignin(body: object): Promise<{ challenge?: string; session?: string; secretCode?: string; error?: string }> {
    const res = await fetch('/api/auth/signin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Sign in failed')
    return data
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { handleChallenge(await postSignin({ email, password })) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Sign in failed') }
    finally { setLoading(false) }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try { handleChallenge(await postSignin({ step: 'new_password', username: email, newPassword, session })) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to set password') }
    finally { setLoading(false) }
  }

  async function handleMfaSetup(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { handleChallenge(await postSignin({ step: 'mfa_setup_verify', session, code: setupCode })) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid code') }
    finally { setLoading(false) }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await postSignin({ email, code: mfaCode, session })
      window.location.href = '/dashboard'
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid code') }
    finally { setLoading(false) }
  }

  const otpauthUri = secretCode
    ? `otpauth://totp/${encodeURIComponent('Equitas Elite')}:${encodeURIComponent(email)}?secret=${secretCode}&issuer=${encodeURIComponent('Equitas Elite')}`
    : ''

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <img src="/logo.png" alt="Equitas Elite" className="h-44 w-auto rounded-xl" />
        </div>

        <div className="glass-panel p-8">

          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Welcome back</h1>
                <p className="text-ee-muted text-sm">Sign in to your Equitas Elite account</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input-field" placeholder="you@firm.com" required autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="input-field" placeholder="••••••••••••••••" required autoComplete="current-password"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="text-center text-xs text-ee-muted">
                Access is by invitation only.{' '}
                <a href="mailto:access@equitaselite.com" className="text-ee-gold hover:underline">Request access</a>
              </p>
              <p className="text-center text-xs text-ee-muted">
                <a href="/pricing" className="hover:text-ee-primary transition-colors">View membership plans →</a>
              </p>
            </form>
          )}

          {step === 'new_password' && (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Set your password</h1>
                <p className="text-ee-muted text-sm">
                  Your temporary password was emailed to you. Choose a new one to continue.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">New password</label>
                  <input
                    type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="input-field" required autoComplete="new-password" autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Confirm password</label>
                  <input
                    type="password" value={confirmPassword} onChange={e => setConfirm(e.target.value)}
                    className="input-field" required autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-ee-muted">
                  Use at least 12 characters with upper- and lower-case letters, a number, and a symbol.
                </p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Saving…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'mfa_setup' && (
            <form onSubmit={handleMfaSetup} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Set up two-factor</h1>
                <p className="text-ee-muted text-sm">
                  Add this account to an authenticator app (1Password, Authy, Google Authenticator).
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-white/5 border border-ee-border rounded-lg p-4 space-y-2">
                  <p className="text-xs text-ee-muted font-data uppercase tracking-wider">Secret key</p>
                  <p className="font-data text-sm text-ee-gold break-all leading-relaxed">
                    {formatSecret(secretCode)}
                  </p>
                </div>

                <a
                  href={otpauthUri}
                  className="block text-center text-xs text-ee-muted hover:text-ee-primary py-1"
                >
                  Open in authenticator (mobile)
                </a>

                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">
                    Verification code
                  </label>
                  <input
                    type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))}
                    className="input-field text-center text-2xl tracking-[0.5em]"
                    placeholder="000000" required autoComplete="one-time-code" autoFocus
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>
          )}

          {step === 'mfa' && (
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
                  type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="input-field text-center text-2xl tracking-[0.5em]"
                  placeholder="000000" required autoComplete="one-time-code" autoFocus
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

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

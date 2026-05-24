'use client'

import { useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'

type Step = 'credentials' | 'new_password' | 'mfa_setup' | 'mfa'

function formatSecret(s: string): string {
  return s.replace(/(.{4})/g, '$1 ').trim()
}

// The Cognito user pool ID is passed in by the server-component wrapper
// (page.tsx) so the SRP password hash can be computed in the browser
// without baking the pool ID into the build at `next build` time. Pool
// IDs are not secrets — they appear in every ID-token issuer claim and
// in the public .well-known JWKS endpoint.
export default function LoginPage({ poolId }: { poolId: string }) {
  const POOL_ID = poolId
  const [step, setStep]               = useState<Step>('credentials')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [secretCode, setSecretCode]   = useState('')
  const [setupCode, setSetupCode]     = useState('')
  const [mfaCode, setMfaCode]         = useState('')
  const [session, setSession]         = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
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
    try {
      // Phase D: client-side SRP. The password never leaves this
      // browser — we compute the SRP proof locally and only send
      // the ephemeral + signature to the server. If POOL_ID isn't
      // configured (rare misdeploy), fall through to the legacy
      // password-POST flow so signin never hard-breaks.
      if (POOL_ID) {
        const helper = await import('cognito-srp-helper')
        const srpSession = helper.createSrpSession(email, password, POOL_ID, false)

        const init = await postSignin({
          step:  'srp_init',
          email,
          srpA:  srpSession.largeA,
        })
        if (init.error) throw new Error(init.error)

        const signed = helper.signSrpSession(srpSession, {
          ChallengeParameters: (init as unknown as {
            challengeParameters: { SALT: string; SECRET_BLOCK: string; SRP_B: string; USER_ID_FOR_SRP: string }
          }).challengeParameters,
        })

        handleChallenge(await postSignin({
          step:                      'srp_verify',
          email,
          session:                   (init as unknown as { session: string }).session,
          srpA:                      signed.largeA,
          srpSmallA:                 signed.smallA,
          passwordClaimSignature:    signed.passwordSignature,
          passwordClaimSecretBlock:  signed.secret,
          timestamp:                 signed.timestamp,
        }))
      } else {
        handleChallenge(await postSignin({ email, password }))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally { setLoading(false) }
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
    try { handleChallenge(await postSignin({ step: 'mfa_setup_verify', session, code: setupCode, username: email })) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Invalid code') }
    finally { setLoading(false) }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await postSignin({ email, code: mfaCode, session, trustDevice })
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

              <div className="text-right -mt-2">
                <Link href="/forgot-password" className="text-xs text-ee-muted hover:text-ee-primary">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="text-center text-xs text-ee-muted">
                Access is by invitation only.{' '}
                <Link href="/request-access" className="text-ee-gold hover:underline">Join the waitlist</Link>
              </p>
              <p className="text-center text-xs text-ee-muted">
                <a href="/pricing" className="hover:text-ee-primary transition-colors">View membership plans →</a>
              </p>
              <p className="text-center text-[11px] text-ee-muted/70 pt-2">
                <Link href="/privacy" className="hover:text-ee-primary transition-colors">Privacy</Link>
                <span className="mx-2">·</span>
                <Link href="/terms" className="hover:text-ee-primary transition-colors">Terms</Link>
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
                {/* QR code — scan with phone authenticator */}
                {otpauthUri && (
                  <div className="flex justify-center bg-white p-4 rounded-lg">
                    <QRCodeSVG
                      value={otpauthUri}
                      size={192}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                )}

                {/* Manual entry fallback */}
                <details className="text-xs">
                  <summary className="text-ee-muted cursor-pointer hover:text-ee-primary py-1 text-center">
                    Can&apos;t scan? Enter the key manually
                  </summary>
                  <div className="mt-2 bg-white/5 border border-ee-border rounded-lg p-4 space-y-2">
                    <p className="text-xs text-ee-muted font-data uppercase tracking-wider">Secret key</p>
                    <p className="font-data text-sm text-ee-gold break-all leading-relaxed">
                      {formatSecret(secretCode)}
                    </p>
                  </div>
                </details>

                <a
                  href={otpauthUri}
                  className="block text-center text-xs text-ee-muted hover:text-ee-primary py-1 md:hidden"
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

              <label className="flex items-start gap-2.5 text-xs text-ee-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                  className="mt-0.5 accent-ee-gold"
                />
                <span>
                  Trust this device for 30 days. Future sign-ins from this browser will
                  skip the verification code.
                </span>
              </label>

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

'use client'

import { useState } from 'react'
import Link from 'next/link'

type Step = 'request' | 'confirm' | 'done'

export default function ForgotPasswordPage() {
  const [step, setStep]                   = useState<Step>('request')
  const [email, setEmail]                 = useState('')
  const [code, setCode]                   = useState('')
  const [newPassword, setNewPassword]     = useState('')
  const [confirmPassword, setConfirm]     = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)

  async function requestCode(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not start password reset.')
      setStep('confirm')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start password reset.')
    } finally { setLoading(false) }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not reset password.')
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset password.')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <img src="/logo.png" alt="Equitas Elite" className="h-44 w-auto rounded-xl" />
        </div>
        <div className="glass-panel p-8 space-y-5">

          {step === 'request' && (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Reset your password</h1>
                <p className="text-ee-muted text-sm">
                  Enter the email on your account. We&apos;ll send a one-time reset code.
                </p>
              </div>
              <div>
                <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-field" placeholder="you@firm.com" required autoComplete="email" autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
              <Link href="/signin" className="block text-center text-xs text-ee-muted hover:text-ee-primary">
                Back to sign in
              </Link>
            </form>
          )}

          {step === 'confirm' && (
            <form onSubmit={submitReset} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl text-ee-gold mb-1">Check your email</h1>
                <p className="text-ee-muted text-sm">
                  We sent a code to <strong>{email}</strong>. Enter it below along with a new password.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Reset code</label>
                  <input
                    type="text" inputMode="numeric" value={code}
                    onChange={e => setCode(e.target.value.replace(/\s+/g, ''))}
                    className="input-field tracking-widest" placeholder="123456" required autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">New password</label>
                  <input
                    type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="input-field" placeholder="At least 16 characters" required autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ee-muted mb-1.5 font-data uppercase tracking-wider">Confirm new password</label>
                  <input
                    type="password" value={confirmPassword} onChange={e => setConfirm(e.target.value)}
                    className="input-field" placeholder="Same again" required autoComplete="new-password"
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full justify-center">
                {loading ? 'Resetting…' : 'Set new password'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError('') }}
                className="w-full text-center text-xs text-ee-muted hover:text-ee-primary"
              >
                Use a different email
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-5">
              <h1 className="font-display text-2xl text-ee-gold">Password updated</h1>
              <p className="text-ee-muted text-sm">
                Your new password is set. You can now sign in.
              </p>
              <Link href="/signin" className="btn-gold w-full justify-center">
                Back to sign in
              </Link>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}

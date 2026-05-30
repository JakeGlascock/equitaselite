'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RequestForm() {
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [firmName, setFirmName] = useState('')
  const [role,     setRole]     = useState<'angel' | 'family_office' | ''>('')
  const [notes,    setNotes]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) { setError('Please select your role.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/request-access', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email, full_name: fullName, firm_name: firmName, role,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="glass-panel p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-ee-emerald/15 border border-ee-emerald/40 flex items-center justify-center mx-auto">
          <span
            className="material-symbols-outlined text-ee-emerald text-2xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
          >
            check
          </span>
        </div>
        <h2 className="font-display text-2xl text-ee-gold">You&apos;re on the waitlist</h2>
        <p className="text-ee-muted text-sm max-w-md mx-auto leading-relaxed">
          Thanks, {fullName.split(' ')[0]}. We&apos;re reviewing applications and inviting members
          in cohorts &mdash; we&apos;ll be in touch from <span className="text-ee-primary">system@equitaselite.com</span> when
          your seat opens up. In the meantime,{' '}
          <Link href="/try" className="text-ee-gold hover:underline">walk through a private demo</Link>{' '}
          while you wait.
        </p>
        <Link href="/" className="inline-block btn-ghost mt-2">Back to home</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 md:p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
            Full name
          </label>
          <input
            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            required maxLength={200}
            className="input-field" placeholder="Alexandra Chen"
          />
        </div>
        <div>
          <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
            Email
          </label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required maxLength={254} autoComplete="email"
            className="input-field" placeholder="you@firm.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
          Firm or family office name
        </label>
        <input
          type="text" value={firmName} onChange={e => setFirmName(e.target.value)}
          required maxLength={200}
          className="input-field" placeholder="Chen Ventures"
        />
      </div>

      <div>
        <p className="text-xs text-ee-muted font-data uppercase tracking-wider mb-2">I am a</p>
        <div className="grid grid-cols-2 gap-3">
          {(['angel', 'family_office'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`p-3 rounded-lg border text-left transition-all ${
                role === r
                  ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                  : 'border-ee-border text-ee-primary hover:border-ee-gold/40'
              }`}
            >
              <p className="font-semibold text-sm">
                {r === 'angel' ? 'Angel investor' : 'Family office'}
              </p>
              <p className="text-xs text-ee-muted mt-0.5">
                {r === 'angel'
                  ? 'Individual deploying personal capital'
                  : 'Multi-generational wealth management'}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-ee-muted font-data uppercase tracking-wider mb-1.5">
          Brief mandate or context (optional)
        </label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={4} maxLength={2000}
          className="input-field resize-none"
          placeholder="Sectors you focus on, typical check size, what brings you to Equitas Elite…"
        />
        <p className="text-[10px] text-ee-muted font-data text-right mt-1">{notes.length}/2000</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !role || !email || !fullName || !firmName}
        className="btn-gold w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting…' : 'Join the waitlist'}
      </button>

      <p className="text-xs text-ee-muted text-center leading-relaxed">
        We&apos;ll only use this information to evaluate your application and reach out.
      </p>
    </form>
  )
}

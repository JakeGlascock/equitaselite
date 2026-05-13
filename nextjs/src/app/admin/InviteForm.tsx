'use client'

import { useState } from 'react'

export default function InviteForm() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      setStatus({ kind: 'success', msg: `Invitation sent to ${data.email}` })
      setEmail('')
    } catch (err: unknown) {
      setStatus({ kind: 'error', msg: err instanceof Error ? err.message : 'Invite failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg text-ee-gold mb-1">Invite a member</h2>
        <p className="text-xs text-ee-muted">
          Cognito will email them a temporary password and onboarding link.
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="firstname.lastname@firm.com"
          className="input-field flex-1"
          required
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !email} className="btn-gold whitespace-nowrap disabled:opacity-40">
          {loading ? 'Sending…' : 'Send invite'}
        </button>
      </div>

      {status && (
        <p className={`text-xs ${status.kind === 'success' ? 'text-ee-emerald' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </form>
  )
}

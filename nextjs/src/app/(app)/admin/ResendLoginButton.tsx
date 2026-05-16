'use client'

import { useState } from 'react'

interface Props {
  userId:          string
  email:           string
  disabled?:       boolean
  disabledReason?: string
}

// Triggers a Cognito email so the user can complete sign-in. The server
// picks RESEND vs password-reset based on Cognito status; this button
// just surfaces which action was taken in the resulting toast.
export default function ResendLoginButton({ userId, email, disabled, disabledReason }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [message, setMessage]       = useState('')
  const [error, setError]           = useState('')

  async function commit() {
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/resend-login?email=${encodeURIComponent(email)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Resend failed')
      setMessage(data.action === 'password_reset' ? 'Password reset sent' : 'Welcome email sent')
      setConfirming(false)
      // Auto-clear the message after a few seconds.
      setTimeout(() => setMessage(''), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Resend failed')
      setConfirming(false)
    } finally {
      setLoading(false)
    }
  }

  if (disabled) {
    return (
      <span className="text-xs text-ee-muted/40 italic" title={disabledReason ?? 'Not eligible'}>—</span>
    )
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={commit}
            disabled={loading}
            className="font-data text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-ee-gold/50 bg-ee-gold/10 text-ee-gold hover:bg-ee-gold/20 disabled:opacity-50"
            title={`Send login email to ${email}`}
          >
            {loading ? '…' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); setError('') }}
            disabled={loading}
            className="text-[10px] text-ee-muted hover:text-ee-primary"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-[10px] text-red-400 max-w-[16rem] text-right">{error}</span>}
      </div>
    )
  }

  if (message) {
    return (
      <span className="text-[10px] text-ee-emerald font-data uppercase tracking-widest">{message}</span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-ee-muted/40 hover:text-ee-gold transition-colors inline-flex items-center justify-center"
      aria-label={`Resend login email to ${email}`}
      title={`Resend login email to ${email}`}
    >
      <span className="material-symbols-outlined text-base leading-none">mail</span>
    </button>
  )
}

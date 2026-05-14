'use client'

import { useState } from 'react'

interface Props {
  userId:      string
  initial:     boolean
  selfUserId:  string  // for safety check
  disabled?:   boolean // for Invited/Disabled/Demo rows where no profile exists
  disabledReason?: string
}

export default function AdminToggle({ userId, initial, selfUserId, disabled, disabledReason }: Props) {
  const [isAdmin, setIsAdmin] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const isSelf = userId === selfUserId

  async function toggle() {
    if (isSelf && isAdmin) {
      setError('You cannot revoke your own admin access.')
      return
    }
    setLoading(true); setError('')
    const next = !isAdmin
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_admin: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setIsAdmin(data.is_admin)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
      setIsAdmin(initial)  // revert
    } finally {
      setLoading(false)
    }
  }

  if (disabled) {
    return (
      <span
        className="text-xs text-ee-muted/50 italic"
        title={disabledReason ?? 'Not eligible'}
      >
        —
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || (isSelf && isAdmin)}
        title={isSelf && isAdmin ? 'You cannot revoke your own admin access' : isAdmin ? 'Revoke admin' : 'Grant admin'}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isAdmin ? 'bg-ee-gold' : 'bg-white/10 border border-ee-border'
        }`}
        aria-label={isAdmin ? 'Revoke admin access' : 'Grant admin access'}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
            isAdmin ? 'translate-x-5 bg-ee-bg' : 'translate-x-0.5 bg-ee-muted'
          }`}
        />
      </button>
      {error && <span className="text-[10px] text-red-400 whitespace-nowrap">{error}</span>}
    </div>
  )
}

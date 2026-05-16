'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId:          string
  email:           string
  disabled?:       boolean
  disabledReason?: string
}

export default function DeleteUserButton({ userId, email, disabled, disabledReason }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function commit() {
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `/api/admin/users/${userId}?email=${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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
            className="font-data text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            title={`Delete ${email}`}
          >
            {loading ? '…' : 'Confirm'}
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

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-ee-muted/40 hover:text-red-400 transition-colors inline-flex items-center justify-center"
      aria-label={`Delete ${email}`}
      title={`Delete ${email}`}
    >
      <span className="material-symbols-outlined text-base leading-none">delete</span>
    </button>
  )
}

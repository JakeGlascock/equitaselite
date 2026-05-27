'use client'

import { useState } from 'react'

// P5d — parent-owned resend control. Appears next to an "Invited"
// next-gen seat on /profile. Click → POST
// /api/me/next-gen-invite/resend with the next-gen's id; toast-style
// inline status. Disabled-after-success keeps the parent from
// spamming the same address.

export default function ResendNextGenInviteButton({ nextGenId }: { nextGenId: string }) {
  const [busy,  setBusy]  = useState(false)
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function resend() {
    setBusy(true); setError('')
    try {
      const res  = await fetch('/api/me/next-gen-invite/resend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ next_gen_id: nextGenId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Resend failed')
      setState('sent')
    } catch (err: unknown) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'sent') {
    return (
      <span className="text-[10px] font-data tracking-[0.12em] uppercase text-ee-emerald">
        Sent
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="text-[10px] font-data tracking-[0.12em] uppercase text-ee-gold hover:underline disabled:opacity-50"
      >
        {busy ? 'Resending…' : 'Resend invite'}
      </button>
      {state === 'error' && (
        <span className="text-[10px] text-red-400 max-w-[12rem] text-right" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

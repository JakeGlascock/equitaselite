'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// P5b — entry control for the /family page. Fires POST /api/me/shadow
// (no body needed — the server resolves the parent from
// parent_profile_id) and refreshes the route on success so the page
// flips into the active-shadow shape. Errors surface inline.

export default function EnterShadowButton({ parentFirstName }: { parentFirstName: string }) {
  const router = useRouter()
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  async function enter() {
    setBusy(true); setError('')
    try {
      const res  = await fetch('/api/me/shadow', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to enter shadow view')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={enter}
        disabled={busy}
        className="btn-gold text-xs disabled:opacity-50"
      >
        {busy ? 'Entering shadow view…' : `View as ${parentFirstName}`}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

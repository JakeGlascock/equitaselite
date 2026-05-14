'use client'

import { useState } from 'react'

export default function RespondButtons({ introId }: { introId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState<'accepted' | 'declined' | null>(null)

  async function respond(status: 'accepted' | 'declined') {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/introductions/${introId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDone(status)
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond('declined')}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-full border border-ee-border text-ee-muted hover:text-ee-primary hover:border-white/20 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => respond('accepted')}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Accept'}
        </button>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

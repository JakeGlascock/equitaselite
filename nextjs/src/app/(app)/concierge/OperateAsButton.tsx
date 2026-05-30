'use client'

import { useState } from 'react'

export default function OperateAsButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function operate() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/concierge/act-as/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={operate}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-full bg-ee-emerald/15 border border-ee-emerald/40 text-ee-emerald hover:brightness-110 disabled:opacity-50 whitespace-nowrap font-data uppercase tracking-wider"
      >
        {loading ? 'Switching…' : 'Operate as →'}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}

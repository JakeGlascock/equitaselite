'use client'

import { useState } from 'react'

// Resets the onboarding test fixture profile back to a pristine
// "just invited" state, sets the acting-as cookie to it, and bounces
// the admin to /onboarding to walk the wizard. No throwaway Cognito
// invite required. The top-banner "Exit" affordance returns the admin
// to their own session.

export default function StartOnboardingTestButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/test-fixtures/onboarding/start', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      window.location.href = '/onboarding'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="btn-gold disabled:opacity-40"
      >
        {loading ? 'Resetting…' : 'Start onboarding test'}
      </button>
      <p className="text-[11px] text-ee-muted">
        Each click resets the fixture to a blank invitee state, sets your acting-as cookie
        to it, and drops you on <code className="font-data">/onboarding</code>.
        Click <strong>Exit</strong> in the top banner when done to return to your own session.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

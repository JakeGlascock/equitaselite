'use client'

import { useEffect, useState } from 'react'

interface Passkey {
  credentialId:            string
  friendlyCredentialName:  string
  relyingPartyId:          string
  createdAt:               string
  authenticatorAttachment: string | undefined
}

// Passkeys / WebAuthn management. Lists what the user has registered
// with Cognito, lets them add a new one (Face ID / Touch ID / hardware
// key — whatever the browser surfaces), or remove an existing one.
// When at least one passkey is registered, /signin gains a "Sign in
// with passkey" button that skips email + password + MFA entirely.

export default function PasskeysSection() {
  const [list, setList]         = useState<Passkey[] | null>(null)
  const [busy, setBusy]         = useState<boolean>(false)
  const [error, setError]       = useState<string>('')
  const [success, setSuccess]   = useState<string>('')

  async function load() {
    try {
      const res  = await fetch('/api/auth/passkey/list', { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load passkeys.')
      setList(data.passkeys as Passkey[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load passkeys.')
      setList([])
    }
  }

  useEffect(() => { void load() }, [])

  async function register() {
    setError(''); setSuccess(''); setBusy(true)
    try {
      // Lazy-import the WebAuthn helper so it stays out of the bundle
      // for users who never touch the section.
      const { startRegistration } = await import('@simplewebauthn/browser')

      const startRes  = await fetch('/api/auth/passkey/register/start', { method: 'POST' })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error ?? 'Could not start passkey registration.')

      // navigator.credentials.create() — iOS / macOS will trigger Face
      // ID / Touch ID; desktops may pop a hardware-key picker.
      const credential = await startRegistration({ optionsJSON: startData.options })

      const completeRes  = await fetch('/api/auth/passkey/register/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credential }),
      })
      const completeData = await completeRes.json()
      if (!completeRes.ok) throw new Error(completeData.error ?? 'Could not register passkey.')

      setSuccess('Passkey registered. Use it on the sign-in page next time.')
      await load()
    } catch (err: unknown) {
      // The WebAuthn API throws DOMException on user-cancel — surface
      // a friendlier message in that specific case.
      const name = (err as { name?: string })?.name ?? ''
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setError('Cancelled — no passkey registered.')
      } else {
        setError(err instanceof Error ? err.message : 'Could not register passkey.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove "${name}"? You won't be able to sign in with it after this.`)) return
    setError(''); setSuccess(''); setBusy(true)
    try {
      const res  = await fetch(`/api/auth/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not remove passkey.')
      setSuccess('Passkey removed.')
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove passkey.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg text-ee-gold mb-1">Passkeys</h3>
        <p className="text-ee-muted text-xs">
          Sign in with Face ID, Touch ID, or a hardware security key instead of your password
          and an authenticator code. Passkeys are bound to <strong>equitaselite.com</strong> —
          phishing-resistant by design.
        </p>
      </div>

      {list === null && <p className="text-ee-muted text-xs">Loading passkeys…</p>}

      {list?.length === 0 && (
        <p className="text-ee-muted text-xs">No passkeys registered yet.</p>
      )}

      {list && list.length > 0 && (
        <ul className="space-y-2">
          {list.map(p => (
            <li
              key={p.credentialId}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-ee-outline/30 bg-ee-surface-mid/40"
            >
              <div className="min-w-0">
                <p className="text-sm text-ee-primary truncate">{p.friendlyCredentialName}</p>
                <p className="text-[10px] font-data tracking-wider text-ee-muted uppercase">
                  Added {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                  {p.authenticatorAttachment ? ` · ${p.authenticatorAttachment}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(p.credentialId, p.friendlyCredentialName)}
                disabled={busy}
                className="text-[10px] uppercase tracking-widest font-data text-ee-muted hover:text-red-400 disabled:opacity-50 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error   && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-ee-emerald text-xs">{success}</p>}

      <button
        type="button"
        onClick={() => void register()}
        disabled={busy}
        className="btn-gold w-full justify-center disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Register a new passkey'}
      </button>
    </div>
  )
}

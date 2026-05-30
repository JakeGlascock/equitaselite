'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// P5c — wealth-holder self-serve next-gen invite. Rendered only for
// callers with is_family_office / is_family_foundation / is_daf;
// /profile gates the render so a plain Angel never sees it.
//
// Submit posts the email to /api/me/next-gen-invite. On success, the
// inviting parent's "Next-gen seats linked to you" list refreshes via
// router.refresh(), so the just-invited next-gen shows up immediately
// as "Invited" (not "Active") since they haven't onboarded.

export default function InviteNextGenForm() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [busy,  setBusy]      = useState(false)
  const [error, setError]     = useState('')
  const [okMsg, setOkMsg]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true); setError(''); setOkMsg('')
    try {
      const res  = await fetch('/api/me/next-gen-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      setOkMsg(`Invite sent to ${trimmed}.`)
      setEmail('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="invite-next-gen-heading"
      className="space-y-2"
    >
      <p
        id="invite-next-gen-heading"
        className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase"
      >
        Invite a next-gen seat
      </p>
      <div className="flex gap-2">
        <label htmlFor="invite-next-gen-email" className="sr-only">
          Email address of the next-gen family member to invite
        </label>
        <input
          id="invite-next-gen-email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="family.member@example.com"
          className="input-field text-sm flex-1"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="btn-gold text-xs px-4 disabled:opacity-50"
        >
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </div>
      <p className="text-[11px] text-ee-muted">
        They&rsquo;ll receive a sign-in email and be linked to your seat as a next-gen.
        Shadow view becomes available to them once they complete onboarding.
      </p>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      {okMsg && <p className="text-xs text-ee-emerald">{okMsg}</p>}
    </form>
  )
}

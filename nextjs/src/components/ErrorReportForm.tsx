'use client'

import { useState } from 'react'

interface Props {
  digest?: string
  // Override the path captured at submission time. Defaults to the
  // current window.location at click time.
  path?: string
  // Free-form key/value pairs sent along with the report. Useful for
  // the preview-denied page to attach the reason code, etc.
  context?: Record<string, unknown>
}

// Unobtrusive "Report this" affordance for error surfaces. Collapsed
// to a single link by default; expands inline to a tiny textarea +
// send. Used on:
//   - app/global-error.tsx
//   - (app)/error.tsx
//   - /preview-denied
// POSTs to /api/feedback/report (public route — error pages render
// without auth context).
export default function ErrorReportForm({ digest, path, context }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [message,  setMessage]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')

  async function submit() {
    if (message.trim().length < 3) {
      setError('Tell us a sentence or two of what happened.')
      return
    }
    setBusy(true); setError('')
    try {
      const submissionPath = path
        ?? (typeof window !== 'undefined'
              ? window.location.pathname + window.location.search
              : '/')
      const res = await fetch('/api/feedback/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: message.trim(),
          path:    submissionPath,
          digest,
          context,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="text-xs text-ee-emerald mt-4">
        Thanks — your report is in. We&apos;ll take a look.
      </p>
    )
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[11px] font-data tracking-widest uppercase text-ee-muted hover:text-ee-gold transition-colors mt-4"
      >
        Report this →
      </button>
    )
  }

  return (
    <div className="mt-4 space-y-2 text-left">
      <textarea
        autoFocus
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What were you trying to do? (a sentence is enough)"
        className="input-field text-xs resize-none"
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setExpanded(false); setMessage(''); setError('') }}
          className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || message.trim().length < 3}
          className="btn-gold text-[10px] py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

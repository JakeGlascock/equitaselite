'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

type FeedbackType = 'bug' | 'idea' | 'other'

interface Props {
  // Optional context tags (tier, role) the widget includes alongside the
  // auto-captured URL + viewport. Stays out of the visible UI — just
  // lands in the staff email so the founder has full picture per submission.
  contextTags?: Record<string, string | undefined>
}

// Ambient feedback widget — Linear / Vercel / Stripe convergence point.
// Zero ambient surface: a small "?" icon in the top-bar utility cluster
// + Cmd+/ keyboard shortcut. Click or shortcut opens a slim modal with
// a type-selector (Bug / Idea / Other), a free-text field, and a Send.
// Auto-captures URL + viewport + any tags the parent passes in.
//
// Submits to /api/feedback/report — the same endpoint used by the
// error-form fallback on /preview-denied + the global error pages.
// Type defaults to 'bug' for the error form; the widget overrides per
// user selection.
export default function FeedbackWidget({ contextTags }: Props) {
  const pathname = usePathname()
  const [open, setOpen]         = useState(false)
  const [type, setType]         = useState<FeedbackType>('idea')
  const [message, setMessage]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')
  const [mounted, setMounted]   = useState(false)
  const textareaRef             = useRef<HTMLTextAreaElement | null>(null)

  // The modal portals to document.body to escape the fixed-positioned
  // header (and its backdrop-blur) where this widget is mounted. body
  // is only available after hydration — guard so SSR markup matches.
  useEffect(() => { setMounted(true) }, [])

  // Cmd+/ (or Ctrl+/) anywhere in the app opens the widget. Same idiom
  // Linear, Vercel, and Notion use for "help/feedback/command palette."
  // The shortcut is intentionally non-destructive — pressing it again
  // while the modal is open does nothing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Reset transient state when the modal closes.
  useEffect(() => {
    if (!open) {
      setSent(false); setError(''); setMessage('')
    } else {
      // Focus the textarea on open so the user can start typing immediately.
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  async function submit() {
    if (message.trim().length < 3) {
      setError('A sentence or two is enough.')
      return
    }
    setBusy(true); setError('')
    try {
      const viewport = typeof window !== 'undefined'
        ? `${window.innerWidth}x${window.innerHeight}`
        : null
      const context: Record<string, unknown> = { viewport, ...(contextTags ?? {}) }
      for (const k of Object.keys(context)) if (context[k] == null) delete context[k]

      const res = await fetch('/api/feedback/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: message.trim(),
          path:    pathname || '/',
          type,
          context,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Send failed')
      }
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback (⌘/)"
        aria-label="Send feedback"
        className="p-2 hover:bg-ee-surface-mid rounded-lg transition-colors hidden sm:block"
      >
        <span className="material-symbols-outlined text-ee-muted text-xl">feedback</span>
      </button>

      {mounted && open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ee-feedback-title"
          className="fixed inset-0 z-[200] flex items-center justify-center px-5"
          style={{
            background:           'rgba(3, 20, 39, 0.55)',
            backdropFilter:       'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="w-full max-w-md p-6 space-y-4 rounded-xl border border-ee-gold/30 shadow-2xl"
            style={{ background: '#0a1f37' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-gold">Send feedback</p>
                <h2 id="ee-feedback-title" className="font-display text-xl text-ee-primary mt-1">
                  {sent ? 'Thanks — got it.' : "What's on your mind?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 -mr-1 -mt-1 text-ee-muted hover:text-ee-primary"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {sent ? (
              <p className="text-sm text-ee-muted leading-relaxed">
                Your {type} report is in. We read every one — if a reply makes sense, you&apos;ll hear back at the email on your profile.
              </p>
            ) : (
              <>
                {/* Type pills */}
                <div className="flex gap-2">
                  {(['bug', 'idea', 'other'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-1.5 rounded-lg border text-[11px] font-data uppercase tracking-widest transition-all ${
                        type === t
                          ? 'border-ee-gold bg-ee-gold/10 text-ee-gold'
                          : 'border-ee-border text-ee-muted hover:text-ee-primary'
                      }`}
                    >
                      {t === 'bug' ? 'Bug' : t === 'idea' ? 'Idea' : 'Other'}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder={
                    type === 'bug'   ? 'What broke? What were you doing?' :
                    type === 'idea'  ? "Something you'd like us to build?" :
                                       'Anything else on your mind?'
                  }
                  className="input-field resize-none text-sm"
                />

                <p className="text-[10px] text-ee-muted font-data tracking-wider">
                  Captured automatically: <span className="text-ee-primary">{pathname || '/'}</span>
                </p>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <div className="flex gap-2 justify-end items-center">
                  <kbd className="hidden sm:inline-block text-[9px] font-data uppercase tracking-widest text-ee-muted mr-auto">
                    ⌘/ to open · esc to close
                  </kbd>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-ghost text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || message.trim().length < 3}
                    className="btn-gold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

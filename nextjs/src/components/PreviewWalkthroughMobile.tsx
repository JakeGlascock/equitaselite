'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { buildPreviewTour } from '@/lib/walkthrough'

// Mobile counterpart to PreviewWalkthroughDriver. On viewports under
// 768px we render a bottom-sheet carousel of the 5-step preview tour
// instead of the driver.js spotlight overlay (which is unusable at
// phone widths). Same dismissal model: sessionStorage keyed flag,
// since preview visitors don't have a profile row to persist against.

const SESSION_KEY       = 'ee_preview_tour_seen'
const MOBILE_BREAKPOINT = 768

export default function PreviewWalkthroughMobile() {
  const pathname = usePathname()
  const [step, setStep]         = useState(0)
  const [closed, setClosed]     = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // SSR-safe viewport detection.
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Honor an existing session-level dismissal so navigating to /dashboard
  // a second time in the same tab doesn't re-fire the carousel.
  const seenInSession =
    typeof window !== 'undefined' && !!sessionStorage.getItem(SESSION_KEY)

  const active =
    !closed &&
    !seenInSession &&
    pathname === '/dashboard' &&
    isMobile

  // Body scroll lock while the sheet is open.
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  if (!active) return null

  const steps   = buildPreviewTour()
  const current = steps[step]
  const isLast  = step === steps.length - 1
  const isFirst = step === 0

  function complete() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    setClosed(true)
  }
  function next() {
    if (isLast) complete()
    else        setStep(s => s + 1)
  }
  function back() { setStep(s => Math.max(0, s - 1)) }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ee-preview-tour-title"
      className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full bg-ee-surface-low border-t border-ee-gold/30 rounded-t-2xl p-6 pb-9 max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          onClick={complete}
          aria-label="Skip tour"
          className="absolute top-4 right-4 p-1 text-ee-muted hover:text-ee-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <div className="flex gap-1.5 mb-5 mr-8" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-ee-gold' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase mb-2">
          Investor preview · Step {step + 1} of {steps.length}
        </p>
        <h2 id="ee-preview-tour-title" className="font-display text-2xl text-ee-gold mb-3 leading-tight">
          {current.title}
        </h2>
        <p className="text-ee-primary text-sm leading-relaxed mb-8">
          {current.body}
        </p>

        <div className="flex gap-3">
          {!isFirst && (
            <button type="button" onClick={back} className="btn-ghost flex-1 text-xs">
              Back
            </button>
          )}
          <button type="button" onClick={next} className="btn-gold flex-1 text-xs">
            {isLast ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

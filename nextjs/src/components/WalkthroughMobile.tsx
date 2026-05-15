'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { buildMobileTour, type TourArgs } from '@/lib/walkthrough'

// Mobile counterpart to WalkthroughDriver. On viewports < 768px we render
// a bottom-sheet carousel instead of a driver.js spotlight tour — overlay
// tours don't fit the screen and there's no useful element-anchoring at
// this width (the top nav is collapsed behind a hamburger).
//
// Both components render in AppShell. Each gates itself on viewport so
// only one ever shows.

const MOBILE_BREAKPOINT = 768

interface Props extends TourArgs {
  pending: boolean
}

export default function WalkthroughMobile(props: Props) {
  const pathname = usePathname()
  const [step, setStep]         = useState(0)
  const [closed, setClosed]     = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Mount-time + resize-driven viewport detection. Default to false so
  // SSR doesn't flash the sheet on desktop.
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const active = props.pending && !closed && pathname === '/dashboard' && isMobile

  // Body scroll lock while the sheet is open so swipes don't drift the
  // page underneath.
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  if (!active) return null

  const steps    = buildMobileTour(props)
  const current  = steps[step]
  const isLast   = step === steps.length - 1
  const isFirst  = step === 0

  async function complete() {
    setClosed(true)
    try {
      await fetch('/api/walkthrough', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'complete' }),
      })
    } catch {
      // Non-fatal — the tour will re-fire on the next dashboard visit,
      // which is acceptable. We don't want to block the user's session
      // on a transient network blip.
    }
  }

  function next() { isLast ? void complete() : setStep(s => s + 1) }
  function back() { setStep(s => Math.max(0, s - 1)) }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ee-walkthrough-title"
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
          Step {step + 1} of {steps.length}
        </p>
        <h2 id="ee-walkthrough-title" className="font-display text-2xl text-ee-gold mb-3 leading-tight">
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

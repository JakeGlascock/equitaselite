'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Layered explainer for the matching score. Opens as a modal sheet over
// the dashboard; closes on click-outside, Esc, or the explicit close
// button. Content is intentionally detailed enough to inspire confidence
// in a sophisticated reader (sector specialist, family office CIO)
// without being so dense it loses a casual user.
export default function MatchingExplainer() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    // Prevent background scroll while the sheet is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-ee-muted hover:text-ee-gold transition-colors font-data uppercase tracking-widest"
        aria-label="How matching works"
      >
        <span className="material-symbols-outlined text-base leading-none">help</span>
        How matching works
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="matching-explainer-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-panel w-full max-w-2xl sm:rounded-2xl rounded-t-2xl p-6 md:p-8 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="font-data text-[10px] tracking-[0.12em] text-ee-gold uppercase">Methodology</p>
                <h2 id="matching-explainer-title" className="font-display text-2xl text-ee-primary mt-1">
                  How matching works
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ee-muted hover:text-ee-primary shrink-0"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6 text-sm leading-relaxed">
              <p className="text-ee-primary">
                Every counterparty in your match list is scored against{' '}
                <strong className="text-ee-gold">your</strong> mandate across six
                pillars. Scores are personal — the same counterparty can rank
                differently for you than for them.
              </p>

              <section>
                <h3 className="font-display text-base text-ee-gold mb-2.5">The six pillars</h3>
                <ul className="space-y-2.5">
                  <PillarRow label="Strategic scope"      body="Sectors, sub-sectors, stage, geography, and thematic focus. The strongest single signal of fit." />
                  <PillarRow label="Capital mechanics"    body="Check-size overlap and lead-or-follow compatibility. Filters out structurally incompatible deals." />
                  <PillarRow label="Time & risk"          body="Holding period and loss-appetite alignment." />
                  <PillarRow label="Governance"           body="Engagement style (board / observer / advisory / passive), diligence depth, decision speed." />
                  <PillarRow label="Counterparty profile" body="Counterparty type and tier preferences." />
                  <PillarRow label="Values & alignment"   body="ESG alignment and impact-theme overlap." />
                </ul>
              </section>

              <section>
                <h3 className="font-display text-base text-ee-gold mb-2">Your weights</h3>
                <p className="text-ee-muted">
                  You decide how heavily each pillar counts. Start from a
                  preset — <em>Diversified</em>, <em>Sector specialist</em>,{' '}
                  <em>Mission-first</em>, or <em>Capital preservation</em> — and
                  fine-tune with six sliders. Pillars you haven&apos;t declared
                  drop out of the weighted average instead of pulling scores down.
                </p>
              </section>

              <section>
                <h3 className="font-display text-base text-ee-gold mb-2">Hard filters</h3>
                <p className="text-ee-muted">
                  Anti-sectors, values exclusions, ESG requirements, and
                  minimum-tier floors don&apos;t lower scores — they hide
                  counterparties from your match list entirely. Hard filters are
                  yours alone: counterparties don&apos;t know you&apos;ve filtered them.
                </p>
              </section>

              <section>
                <h3 className="font-display text-base text-ee-gold mb-2">Score bands</h3>
                <p className="text-ee-muted">
                  <strong className="text-ee-emerald">Strong Fit</strong> 80+ ·{' '}
                  <strong className="text-ee-gold">Good Fit</strong> 65–79 ·{' '}
                  <strong className="text-ee-gold/70">Possible Fit</strong> 50–64 ·{' '}
                  <strong className="text-red-400/80">Low Fit</strong> below 50.
                </p>
              </section>

              <div className="pt-3 border-t border-ee-border flex items-center justify-between gap-4 flex-wrap">
                <Link
                  href="/profile"
                  className="btn-gold text-xs whitespace-nowrap"
                  onClick={() => setOpen(false)}
                >
                  Tune your mandate →
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-ee-muted hover:text-ee-primary font-data uppercase tracking-widest"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PillarRow({ label, body }: { label: string; body: string }) {
  return (
    <li className="flex flex-col sm:flex-row sm:gap-4">
      <span className="font-data text-[10px] uppercase tracking-widest text-ee-gold pt-0.5 sm:w-40 shrink-0">
        {label}
      </span>
      <span className="text-ee-muted flex-1">{body}</span>
    </li>
  )
}

'use client'

import { useId, useState } from 'react'
import type { MatchScore, MandateWeights } from '@/types'
import { labelForAssetClass } from '@/lib/asset-classes'

// P2 — "Why this score" explainability panel.
//
// Built around the principle that EE's algorithmic trust layer must be
// *defensible*, not magical. Each pillar shows three things:
//
//   1. Your weight  — how much YOU said this pillar matters
//   2. The fit      — how well the candidate scores on this pillar
//   3. The points   — weight × fit, contributing to the headline total
//
// Scope pillar also surfaces the concrete overlap sets (sectors,
// stages, geography, asset classes) so a member can see exactly
// which of THEIR mandate items did and didn't align — no black box.

// Sub-set of viewer mandate fields needed for the overlap display.
// Optional so existing call sites that don't yet pass this prop
// degrade gracefully (the panel still shows the per-pillar math,
// just without the overlap evidence).
export interface ViewerForBreakdown {
  sectors:        string[]
  stages:         string[]
  geography:      string[]
  assetClasses?:  string[]
}

export interface CandidateForBreakdown {
  sectors:        string[]
  stages:         string[]
  geography:      string[]
  assetClasses?:  string[]
}

// Default weights mirror migration 028's bake-in. Used only when the
// viewer has none persisted — keeps the math display honest for new
// signups who haven't touched MandateWeightsForm yet.
const DEFAULT_WEIGHTS: MandateWeights = {
  scope: 40, capital: 25, timeRisk: 10,
  governance: 5, counterparty: 10, values: 10,
}

const PILLAR_ORDER: ReadonlyArray<{
  key:    keyof NonNullable<MatchScore['pillars']>
  label:  string
  weight: keyof MandateWeights
}> = [
  { key: 'scope',        label: 'Scope',        weight: 'scope'        },
  { key: 'capital',      label: 'Capital',      weight: 'capital'      },
  { key: 'counterparty', label: 'Counterparty', weight: 'counterparty' },
  { key: 'values',       label: 'Values',       weight: 'values'       },
  { key: 'timeRisk',     label: 'Time / risk',  weight: 'timeRisk'     },
  { key: 'governance',   label: 'Governance',   weight: 'governance'   },
]

function intersect(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b)
  return a.filter(x => set.has(x))
}

function diff(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b)
  return a.filter(x => !set.has(x))
}

function OverlapRow({
  label, mine, theirs, formatLabel,
}: {
  label:        string
  mine:         readonly string[]
  theirs:       readonly string[]
  formatLabel?: (key: string) => string
}) {
  if (mine.length === 0 && theirs.length === 0) return null
  const fmt   = formatLabel ?? ((s: string) => s)
  const both  = intersect(mine, theirs)
  const onlyM = diff(mine,   theirs)
  const onlyT = diff(theirs, mine)
  return (
    <div className="space-y-1.5">
      <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {both.map(s => (
          <span key={`b-${s}`}
            className="text-[11px] px-2 py-0.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald"
            title="You both picked this">
            {fmt(s)}
          </span>
        ))}
        {onlyM.map(s => (
          <span key={`m-${s}`}
            className="text-[11px] px-2 py-0.5 rounded-full border border-ee-border text-ee-muted"
            title="Only you picked this">
            {fmt(s)}
          </span>
        ))}
        {onlyT.map(s => (
          <span key={`t-${s}`}
            className="text-[11px] px-2 py-0.5 rounded-full border border-ee-border/60 text-ee-muted/70 italic"
            title="Only they picked this">
            {fmt(s)}
          </span>
        ))}
        {(both.length + onlyM.length + onlyT.length) === 0 && (
          <span className="text-[11px] text-ee-muted/60 italic">Neither side declared.</span>
        )}
      </div>
    </div>
  )
}

export default function MatchScoreBreakdown({
  score, viewer, candidate, viewerWeights,
}: {
  score:          MatchScore
  viewer?:        ViewerForBreakdown
  candidate?:     CandidateForBreakdown
  viewerWeights?: MandateWeights
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const weights = viewerWeights ?? DEFAULT_WEIGHTS
  const pillars = score.pillars

  if (!pillars) {
    // Legacy score without pillar breakdown — nothing useful to show.
    return null
  }

  // Compute the per-pillar contribution exactly the way computeMatchScore
  // does: only declared pillars contribute, and the denominator is
  // re-normalized over surviving weights. We can't know "declared" from
  // outside the scorer, so we proxy with "pillar > 0" — close enough for
  // the UI; the headline total in `score.total` is the source of truth.
  const declared = PILLAR_ORDER
    .map(p => ({ ...p, fit: pillars[p.key], w: weights[p.weight] ?? 0 }))
    .filter(p => p.fit > 0)
  const denom    = declared.reduce((s, p) => s + p.w, 0)

  return (
    <details
      open={open}
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-3 border-t border-ee-border/40 pt-3"
    >
      <summary
        className="cursor-pointer list-none flex items-center justify-between gap-2 text-[11px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-primary"
        aria-controls={panelId}
        aria-expanded={open}
      >
        <span>Why this score</span>
        <span className="text-base leading-none transition-transform" aria-hidden style={{
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}>+</span>
      </summary>

      <div id={panelId} className="mt-3 space-y-4">
        {/* Per-pillar math */}
        <div className="space-y-1.5">
          <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
            How the {score.total} was built
          </p>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-ee-muted/70 font-data uppercase">
              <tr>
                <th className="text-left  font-normal py-1">Pillar</th>
                <th className="text-right font-normal py-1">Your weight</th>
                <th className="text-right font-normal py-1">Fit</th>
                <th className="text-right font-normal py-1">Points</th>
              </tr>
            </thead>
            <tbody>
              {PILLAR_ORDER.map(p => {
                const fit  = pillars[p.key]
                const w    = weights[p.weight] ?? 0
                const contrib = denom > 0 && fit > 0
                  ? Math.round((fit * w) / denom)
                  : 0
                const dimmed = fit === 0
                return (
                  <tr key={p.key} className={dimmed ? 'text-ee-muted/60' : 'text-ee-primary'}>
                    <td className="py-1">{p.label}</td>
                    <td className="py-1 text-right tabular-nums">{w}%</td>
                    <td className="py-1 text-right tabular-nums">{fit}</td>
                    <td className="py-1 text-right tabular-nums font-medium">
                      {dimmed ? '—' : `+${contrib}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ee-border/40 text-ee-gold">
                <td className="pt-2 font-data text-[10px] uppercase tracking-widest">Total</td>
                <td colSpan={2} />
                <td className="pt-2 text-right tabular-nums font-semibold">{score.total}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[10px] text-ee-muted/70 leading-snug">
            Dimmed pillars weren&rsquo;t declared on both sides, so they don&rsquo;t pull
            the total down. Re-weight in <a href="/profile" className="underline">your profile</a>.
          </p>
        </div>

        {/* Scope evidence — only when we have both sides' arrays */}
        {viewer && candidate && (
          <div className="space-y-3 border-t border-ee-border/40 pt-3">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted">
              What overlapped (Scope)
            </p>
            <OverlapRow label="Sectors"      mine={viewer.sectors}   theirs={candidate.sectors} />
            <OverlapRow label="Stages"       mine={viewer.stages}    theirs={candidate.stages} />
            <OverlapRow label="Geography"    mine={viewer.geography} theirs={candidate.geography} />
            {(viewer.assetClasses?.length || candidate.assetClasses?.length) ? (
              <OverlapRow
                label="Asset classes"
                mine={viewer.assetClasses   ?? []}
                theirs={candidate.assetClasses ?? []}
                formatLabel={labelForAssetClass}
              />
            ) : null}
            <p className="text-[10px] text-ee-muted/70 leading-snug">
              <span className="inline-block w-2 h-2 rounded-full bg-ee-emerald/60 align-middle mr-1" />
              You both picked&nbsp;·&nbsp;
              <span className="inline-block w-2 h-2 rounded-full border border-ee-border align-middle mr-1" />
              Only you&nbsp;·&nbsp;
              <span className="inline-block w-2 h-2 rounded-full border border-ee-border/60 align-middle mr-1" />
              Only them
            </p>
          </div>
        )}
      </div>
    </details>
  )
}

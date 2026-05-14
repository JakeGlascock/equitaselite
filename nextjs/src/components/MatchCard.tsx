'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { MatchScore } from '@/types'

export interface IntroState {
  status:       'pending' | 'accepted' | 'declined' | null
  direction:    'outgoing' | 'incoming' | null
  contactEmail: string | null
}

interface Match {
  id: string
  fullName: string
  title: string | null
  firmName: string
  location: string | null
  aum: string | null
  role: 'angel' | 'family_office'
  sectors: string[]
  stages: string[]
  geography: string[]
  checkSizeMin: number
  checkSizeMax: number
  score: MatchScore
  intro: IntroState
}

const RING_R  = 36
const RING_C  = 2 * Math.PI * RING_R  // circumference

const LABEL_COLOR: Record<MatchScore['label'], string> = {
  'Strong Fit':   '#4edea3',
  'Good Fit':     '#e9c176',
  'Possible Fit': '#f59e0b',
  'Low Fit':      '#ef4444',
}

function ScoreRing({ score, label }: { score: number; label: MatchScore['label'] }) {
  const color  = LABEL_COLOR[label]
  const filled = (score / 100) * RING_C
  const gap    = RING_C - filled

  return (
    <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle
          cx="48" cy="48" r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="8"
        />
        <circle
          cx="48" cy="48" r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-data text-xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-ee-muted w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-ee-gold/60 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-ee-muted w-8 text-right">{value}%</span>
    </div>
  )
}

function checkDisplay(min: number, max: number): string {
  const fmt = (v: number) => v >= 1 ? `$${v}M` : `$${v * 1000}K`
  return `${fmt(min)}–${fmt(max)}`
}

function IntroAction({ recipientId, recipientFirstName, initial, canSendIntros = true }: {
  recipientId: string
  recipientFirstName: string
  initial: IntroState
  canSendIntros?: boolean
}) {
  const [intro, setIntro]         = useState<IntroState>(initial)
  const [composing, setComposing] = useState(false)
  const [message, setMessage]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function send() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/introductions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recipient_id: recipientId,
          message:      message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setIntro({ status: 'pending', direction: 'outgoing', contactEmail: null })
      setComposing(false)
      setMessage('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (intro.status === 'accepted' && intro.contactEmail) {
    return (
      <a
        href={`mailto:${intro.contactEmail}`}
        className="text-xs px-3 py-1.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 whitespace-nowrap"
      >
        Introduced · email
      </a>
    )
  }
  if (intro.status === 'pending' && intro.direction === 'outgoing') {
    return <span className="text-xs px-3 py-1.5 rounded-full border border-ee-border text-ee-muted whitespace-nowrap">Awaiting response</span>
  }
  if (intro.status === 'pending' && intro.direction === 'incoming') {
    return (
      <a
        href="/connections"
        className="text-xs px-3 py-1.5 rounded-full border border-ee-gold/40 bg-ee-gold/10 text-ee-gold hover:brightness-110 whitespace-nowrap"
      >
        Respond →
      </a>
    )
  }
  if (intro.status === 'declined') {
    return <span className="text-xs px-3 py-1.5 rounded-full border border-ee-border text-ee-muted/60 whitespace-nowrap">Declined</span>
  }

  if (composing) {
    return (
      <div className="w-full space-y-2">
        <label className="block text-[10px] text-ee-muted font-data uppercase tracking-wider">
          Add a note for {recipientFirstName} (optional)
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={`Saw your mandate — would love to compare notes on…`}
          className="input-field text-xs resize-none leading-relaxed"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ee-muted font-data">{message.length}/500</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setComposing(false); setMessage(''); setError('') }}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full border border-ee-border text-ee-muted hover:text-ee-primary hover:border-white/20 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // No existing intro AND the user's tier blocks new ones → upgrade CTA
  if (!canSendIntros) {
    return (
      <Link
        href="/pricing"
        className="text-xs px-3 py-1.5 rounded-full border border-ee-gold/40 bg-ee-gold/10 text-ee-gold hover:brightness-110 whitespace-nowrap"
        title="Introductions require Select or Sovereign membership"
      >
        Upgrade to introduce
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setComposing(true)}
      className="text-xs px-3 py-1.5 rounded-full bg-ee-gold text-ee-bg font-semibold hover:brightness-110 whitespace-nowrap"
    >
      Request introduction
    </button>
  )
}

export default function MatchCard({ match, canSendIntros = true }: { match: Match; canSendIntros?: boolean }) {
  const { score } = match
  const color = LABEL_COLOR[score.label]

  return (
    <div className="glass-panel p-6 flex gap-6">
      <ScoreRing score={score.total} label={score.label} />

      <div className="flex-1 min-w-0 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ee-primary truncate">{match.fullName}</p>
            <p className="text-xs text-ee-muted truncate">
              {match.title ? `${match.title} · ` : ''}{match.firmName}
              {match.location ? ` · ${match.location}` : ''}
            </p>
          </div>
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ color, borderColor: color, background: `${color}18` }}
          >
            {score.label}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
            {match.role === 'angel' ? 'Angel' : 'Family Office'}
          </span>
          {match.aum && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
              AUM {match.aum}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
            {checkDisplay(match.checkSizeMin, match.checkSizeMax)}
          </span>
          {match.sectors.slice(0, 3).map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-ee-gold/10 border border-ee-gold/20 text-xs text-ee-gold">
              {s}
            </span>
          ))}
          {match.sectors.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-ee-border text-xs text-ee-muted">
              +{match.sectors.length - 3}
            </span>
          )}
        </div>

        {/* Score breakdown */}
        <div className="space-y-1.5 pt-1">
          <SubScore label="Sectors"   value={score.sector} />
          <SubScore label="Stages"    value={score.stage} />
          <SubScore label="Check sz." value={score.checkSize} />
          <SubScore label="Geography" value={score.geography} />
        </div>

        {/* Introduction action */}
        <div className="flex justify-end pt-2">
          <IntroAction
            recipientId={match.id}
            recipientFirstName={match.fullName.split(' ')[0]}
            initial={match.intro}
            canSendIntros={canSendIntros}
          />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'

interface DemoProfile {
  id:        string
  full_name: string
  firm_name: string
  role:      'angel' | 'family_office'
  membership?: 'access' | 'select' | 'sovereign' | null
}

interface TokenSummary {
  token:            string
  label:            string
  demo_profile_id:  string
  expires_at:       string
  max_views:        number
  view_count:       number
  last_viewed_at:   string | null
  revoked_at:       string | null
  created_at:       string
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tokenStatus(t: TokenSummary): { label: string; color: string } {
  if (t.revoked_at)                                  return { label: 'Revoked',   color: 'text-ee-muted' }
  if (new Date(t.expires_at).getTime() <= Date.now()) return { label: 'Expired',   color: 'text-ee-muted' }
  if (t.view_count >= t.max_views)                    return { label: 'Exhausted', color: 'text-ee-muted' }
  return { label: 'Active', color: 'text-ee-emerald' }
}

export default function PreviewTokensPanel({ demoProfiles }: { demoProfiles: DemoProfile[] }) {
  const [tokens, setTokens]       = useState<TokenSummary[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [label, setLabel]         = useState('')
  const [profileId, setProfileId] = useState(demoProfiles[0]?.id ?? '')
  const [ttl, setTtl]             = useState(14)
  const [maxViews, setMaxViews]   = useState(25)
  const [justMinted, setJustMinted] = useState<{ url: string; label: string } | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  function copyLink(token: string) {
    const url = `${window.location.origin}/preview/${token}`
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(t => t === token ? null : t), 1500)
      })
      .catch(() => { /* clipboard blocked; user can re-mint or refresh */ })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/preview-tokens')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setTokens(data.tokens ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function mint(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!label.trim() || !profileId) return
    try {
      const res = await fetch('/api/admin/preview-tokens', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          label:           label.trim(),
          demo_profile_id: profileId,
          ttl_days:        ttl,
          max_views:       maxViews,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Mint failed')
      const url = `${window.location.origin}/preview/${data.token}`
      setJustMinted({ url, label: label.trim() })
      setLabel('')
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mint failed')
    }
  }

  async function revoke(token: string) {
    if (!confirm('Revoke this preview link? Anyone holding it will be cut off immediately.')) return
    try {
      const res = await fetch('/api/admin/preview-tokens', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={mint} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Label (for your records)</span>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              required minLength={2} maxLength={120}
              className="input-field mt-1.5"
              placeholder="e.g. Sequoia — John D."
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">View as (demo profile)</span>
            <select
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
              required
              className="input-field mt-1.5"
            >
              {demoProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.firm_name} ({p.role === 'angel' ? 'Angel' : 'FO'}{p.membership ? ` · ${p.membership}` : ''})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Expires in (days)</span>
            <input
              type="number"
              min={1} max={90}
              value={ttl}
              onChange={e => setTtl(Number(e.target.value))}
              className="input-field mt-1.5"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-data uppercase tracking-widest text-ee-muted">Max views</span>
            <input
              type="number"
              min={1} max={500}
              value={maxViews}
              onChange={e => setMaxViews(Number(e.target.value))}
              className="input-field mt-1.5"
            />
          </label>
        </div>

        <button type="submit" className="btn-gold text-xs">
          Generate preview link
        </button>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      {justMinted && (
        <div className="glass-panel border-ee-gold/40 p-4 space-y-2">
          <p className="text-xs text-ee-gold font-data uppercase tracking-widest">Link ready — copy now, it won&apos;t be shown again</p>
          <p className="text-sm text-ee-primary">
            <strong>{justMinted.label}</strong>
          </p>
          <div className="flex gap-2 items-stretch">
            <input
              readOnly
              value={justMinted.url}
              onFocus={e => e.currentTarget.select()}
              className="input-field text-xs flex-1 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(justMinted.url)
                  .catch(() => { /* clipboard blocked — user can still select manually */ })
              }}
              className="btn-ghost text-xs whitespace-nowrap"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-data uppercase tracking-widest text-ee-muted mb-2">
          Existing tokens {loading && '· loading…'}
        </p>
        {tokens.length === 0 ? (
          <p className="text-xs text-ee-muted">No preview tokens yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ee-muted text-left">
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Label</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">As</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Views</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Expires</th>
                  <th className="py-1.5 pr-3 font-data uppercase tracking-widest text-[10px]">Status</th>
                  <th className="py-1.5 font-data uppercase tracking-widest text-[10px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ee-border/40">
                {tokens.map(t => {
                  const s = tokenStatus(t)
                  return (
                    <tr key={t.token}>
                      <td className="py-2 pr-3 text-ee-primary">{t.label}</td>
                      <td className="py-2 pr-3 text-ee-muted truncate max-w-[180px]" title={t.demo_profile_id}>
                        {t.demo_profile_id.replace(/^demo_(angel|fo)_/, '')}
                      </td>
                      <td className="py-2 pr-3 text-ee-muted">{t.view_count}/{t.max_views}</td>
                      <td className="py-2 pr-3 text-ee-muted">{fmtDate(t.expires_at)}</td>
                      <td className={`py-2 pr-3 ${s.color}`}>{s.label}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            type="button"
                            onClick={() => copyLink(t.token)}
                            title={`${typeof window !== 'undefined' ? window.location.origin : ''}/preview/${t.token.slice(0, 8)}…`}
                            className={`text-[10px] font-data uppercase tracking-widest transition-colors ${
                              copiedToken === t.token ? 'text-ee-emerald' : 'text-ee-muted hover:text-ee-gold'
                            }`}
                          >
                            {copiedToken === t.token ? 'Copied' : 'Copy link'}
                          </button>
                          {!t.revoked_at && (
                            <button
                              type="button"
                              onClick={() => revoke(t.token)}
                              className="text-[10px] font-data uppercase tracking-widest text-ee-muted hover:text-red-400"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

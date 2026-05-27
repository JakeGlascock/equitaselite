'use client'

import { useEffect, useState } from 'react'

type NotificationType =
  | 'intro_requested'
  | 'intro_accepted'
  | 'intro_declined'
  | 'deal_invitation'
  | 'deal_interest'
  | 'deal_message'
  | 'next_gen_shadow'

interface Notification {
  id:         string
  // The server-side CHECK enforces this exhaustively (see migration
  // 044). The `string` fallback keeps the renderer tolerant if a
  // future type ships before this client is updated — it draws the
  // FALLBACK icon/color instead of crashing.
  type:       NotificationType | string
  title:      string
  body:       string | null
  link_url:   string | null
  is_read:    boolean
  created_at: string
}

// Material Symbols glyph + accent color per known type. Unknown types
// fall through to the FALLBACK pair so a new server-side notification
// shape never renders as a blank chip.
const ICON_BY_TYPE: Record<NotificationType, string> = {
  intro_requested: 'handshake',
  intro_accepted:  'check_circle',
  intro_declined:  'cancel',
  deal_invitation: 'workspaces',
  deal_interest:   'star',
  deal_message:    'forum',
  next_gen_shadow: 'visibility',
}

const COLOR_BY_TYPE: Record<NotificationType, string> = {
  intro_requested: '#e9c176',
  intro_accepted:  '#4edea3',
  intro_declined:  '#8892a4',
  deal_invitation: '#e9c176',
  deal_interest:   '#4edea3',
  deal_message:    '#8aa8ff',
  next_gen_shadow: '#e9c176',
}

const FALLBACK_ICON  = 'notifications'
const FALLBACK_COLOR = '#8892a4'

function iconFor (t: string): string { return ICON_BY_TYPE[t  as NotificationType] ?? FALLBACK_ICON  }
function colorFor(t: string): string { return COLOR_BY_TYPE[t as NotificationType] ?? FALLBACK_COLOR }

function relativeTime(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsBell() {
  const [open, setOpen]     = useState(false)
  const [items, setItems]   = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchAll() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setItems(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  // Initial fetch + every 60s while mounted (only fires API call when tab visible)
  useEffect(() => {
    fetchAll()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll()
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Refetch when drawer opens to catch newer items
  useEffect(() => { if (open) fetchAll() }, [open])

  const unread = items.filter(n => !n.is_read).length

  async function markRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try { await fetch(`/api/notifications/${id}`, { method: 'PATCH' }) }
    catch { /* ignore */ }
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    try { await fetch('/api/notifications/mark-all-read', { method: 'POST' }) }
    catch { /* ignore */ }
  }

  function handleClick(n: Notification) {
    if (!n.is_read) void markRead(n.id)
    if (n.link_url) window.location.href = n.link_url
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 hover:bg-ee-surface-mid rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-ee-muted text-xl">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-ee-gold text-ee-bg text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-12 right-4 w-[22rem] max-w-[calc(100vw-2rem)] bg-ee-surface-low border border-ee-outline/40 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ee-outline/30">
              <h2 className="font-display text-base text-ee-primary">Notifications</h2>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] text-ee-muted hover:text-ee-gold font-data uppercase tracking-wider"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-xs text-ee-muted">Loading…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="material-symbols-outlined text-ee-muted text-3xl">notifications_off</span>
                  <p className="text-xs text-ee-muted mt-2">No notifications yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ee-outline/20">
                  {items.map(n => {
                    const color = colorFor(n.type)
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleClick(n)}
                          className={`w-full text-left px-4 py-3 transition-colors hover:bg-ee-surface-mid flex gap-3 ${
                            n.is_read ? '' : 'bg-ee-gold/[0.04]'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${color}1f`, border: `1px solid ${color}55` }}
                          >
                            <span className="material-symbols-outlined text-base" style={{ color }}>
                              {iconFor(n.type)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <p className={`text-sm leading-snug ${n.is_read ? 'text-ee-muted' : 'text-ee-primary'}`}>
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-ee-gold mt-1.5 shrink-0" />
                              )}
                            </div>
                            {n.body && (
                              <p className="text-xs text-ee-muted truncate mt-0.5">{n.body}</p>
                            )}
                            <p className="text-[10px] text-ee-muted/70 mt-1 font-data">{relativeTime(n.created_at)}</p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

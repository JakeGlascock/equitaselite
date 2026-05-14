'use client'

import { useMemo, useState } from 'react'
import AdminToggle from './AdminToggle'
import ConciergeToggle from './ConciergeToggle'
import ManagedAccountAssignment from './ManagedAccountAssignment'

export type MemberStatus = 'Invited' | 'Onboarding' | 'Active' | 'Disabled' | 'Demo'

export interface MemberRow {
  email:       string
  name:        string | null
  firm:        string | null
  role:        'angel' | 'family_office' | null
  status:      MemberStatus
  joined:      string  // ISO
  userId:      string | null
  isAdmin:     boolean
  isConcierge: boolean
  managedBy:   string | null
  togglable:   boolean
  toggleReason?: string
}

export interface ConciergeOption {
  id:        string
  full_name: string
  firm_name: string | null
}

const STATUS_STYLES: Record<MemberStatus, string> = {
  Active:     'border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald',
  Onboarding: 'border-ee-gold/40    bg-ee-gold/10    text-ee-gold',
  Invited:    'border-ee-primary/30 bg-ee-primary/10 text-ee-primary',
  Disabled:   'border-ee-border     bg-white/5       text-ee-muted',
  Demo:       'border-ee-border     bg-white/5       text-ee-muted',
}

const STATUS_FILTERS: Array<{ key: 'all' | MemberStatus; label: string }> = [
  { key: 'all',        label: 'All'        },
  { key: 'Invited',    label: 'Invited'    },
  { key: 'Onboarding', label: 'Onboarding' },
  { key: 'Active',     label: 'Active'     },
  { key: 'Demo',       label: 'Demo'       },
]

const PAGE_SIZE = 20

function fmtDate(s: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MembersTable({
  rows, selfUserId, concierges,
}: {
  rows:        MemberRow[]
  selfUserId:  string
  concierges:  ConciergeOption[]
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<typeof STATUS_FILTERS[number]['key']>('all')
  const [page,   setPage]   = useState(1)

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter(r => r.status === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.email.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.firm ?? '').toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, status, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function setStatusAndReset(k: typeof status) { setStatus(k); setPage(1) }
  function setSearchAndReset(v: string)         { setSearch(v); setPage(1) }

  return (
    <div className="glass-panel overflow-hidden">
      {/* Controls */}
      <div className="px-6 py-4 border-b border-ee-border space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-display text-base text-ee-primary">Members</h2>
          <p className="text-xs text-ee-muted font-data">
            {filtered.length === rows.length
              ? `${rows.length} total`
              : `${filtered.length} of ${rows.length}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ee-muted text-lg pointer-events-none">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearchAndReset(e.target.value)}
              placeholder="Search email, name, or firm…"
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-1 bg-white/5 border border-ee-border rounded-lg p-1">
            {STATUS_FILTERS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatusAndReset(s.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  status === s.key ? 'bg-ee-gold text-ee-bg' : 'text-ee-muted hover:text-ee-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {pageRows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ee-muted">
          No members match the current filters.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
              <th className="text-left  px-6 py-3 font-normal">Email</th>
              <th className="text-left  px-6 py-3 font-normal">Name</th>
              <th className="text-left  px-6 py-3 font-normal">Role</th>
              <th className="text-left  px-6 py-3 font-normal">Status</th>
              <th className="text-left  px-6 py-3 font-normal">Admin</th>
              <th className="text-left  px-6 py-3 font-normal">Concierge</th>
              <th className="text-left  px-6 py-3 font-normal">Managed by</th>
              <th className="text-right px-6 py-3 font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(m => (
              <tr key={m.email} className="border-t border-ee-border/60">
                <td className="px-6 py-3 text-ee-primary truncate max-w-[14rem]">{m.email}</td>
                <td className="px-6 py-3 text-ee-muted">{m.name ?? '—'}</td>
                <td className="px-6 py-3 text-ee-muted">
                  {m.role === 'angel' ? 'Angel' : m.role === 'family_office' ? 'Family Office' : '—'}
                </td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {m.userId ? (
                    <AdminToggle
                      userId={m.userId}
                      initial={m.isAdmin}
                      selfUserId={selfUserId}
                      disabled={!m.togglable}
                      disabledReason={m.toggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {m.userId ? (
                    <ConciergeToggle
                      userId={m.userId}
                      initial={m.isConcierge}
                      disabled={!m.togglable}
                      disabledReason={m.toggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {m.userId && !m.isConcierge ? (
                    <ManagedAccountAssignment
                      accountId={m.userId}
                      currentId={m.managedBy}
                      concierges={concierges}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic"
                      title={m.isConcierge ? 'Concierges manage others, not the reverse' : 'Profile not created yet'}>
                      —
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right text-ee-muted">{fmtDate(m.joined)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-ee-border flex items-center justify-between text-xs">
          <span className="text-ee-muted font-data">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-md border border-ee-border text-ee-muted hover:text-ee-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-md border border-ee-border text-ee-muted hover:text-ee-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

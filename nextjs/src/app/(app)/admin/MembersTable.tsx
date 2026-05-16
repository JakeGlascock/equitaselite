'use client'

import { useMemo, useState } from 'react'
import AdminToggle from './AdminToggle'
import ConciergeToggle from './ConciergeToggle'
import DeleteUserButton from './DeleteUserButton'
import ResendLoginButton from './ResendLoginButton'
import ManagedAccountAssignment from './ManagedAccountAssignment'
import TierAssignment from './TierAssignment'
import RmAssignment from './RmAssignment'

export type MemberStatus = 'Invited' | 'Onboarding' | 'Active' | 'Disabled' | 'Demo'
export type Membership   = 'access' | 'select' | 'sovereign'

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
  membership:  Membership | null
  relationshipManagerId: string | null
  togglable:   boolean
  // Whether Admin / Concierge / RM toggles are clickable for this row.
  // Demo accounts can have their tier changed (so you can preview each
  // tier's UI) but not their admin/concierge/RM flags — those make no
  // sense for fixtures.
  staffTogglable: boolean
  toggleReason?:      string
  staffToggleReason?: string
  // ID used by the Delete button. Equals the profile id when one exists,
  // else the Cognito sub (so Invited / Disabled users without a profile
  // can still be cleaned up). Null only when neither is available.
  deleteId:       string | null
  // Whether the Delete button is enabled. Disabled for: self, admins,
  // concierges, and demo profiles.
  deletable:      boolean
  deleteReason?:  string
  // Whether the Resend-login button is enabled. Disabled for demo /
  // managed profiles (no Cognito sign-in to trigger an email for).
  resendable:     boolean
  resendReason?:  string
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
  const [tier,   setTier]   = useState<'all' | Membership | 'none'>('all')
  const [page,   setPage]   = useState(1)

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter(r => r.status === status)
    if (tier !== 'all') {
      out = tier === 'none'
        ? out.filter(r => !r.membership)
        : out.filter(r => r.membership === tier)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.email.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.firm ?? '').toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, status, tier, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function setStatusAndReset(k: typeof status) { setStatus(k); setPage(1) }
  function setTierAndReset(k: typeof tier)      { setTier(k);   setPage(1) }
  function setSearchAndReset(v: string)         { setSearch(v); setPage(1) }

  const TIER_FILTERS: Array<{ key: typeof tier; label: string }> = [
    { key: 'all',       label: 'Any tier'  },
    { key: 'access',    label: 'Access'    },
    { key: 'select',    label: 'Select'    },
    { key: 'sovereign', label: 'Sovereign' },
    { key: 'none',      label: 'Unset'     },
  ]

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
        <div className="flex gap-1 bg-white/5 border border-ee-border rounded-lg p-1 self-start">
          {TIER_FILTERS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTierAndReset(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tier === t.key ? 'bg-ee-gold text-ee-bg' : 'text-ee-muted hover:text-ee-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {pageRows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ee-muted">
          No members match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto min-w-[820px]">
            <thead>
              <tr className="text-xs text-ee-muted uppercase tracking-wider font-data">
                <th className="text-left  px-3 py-2 font-normal">Member</th>
                <th className="text-left  px-2 py-2 font-normal">Role</th>
                <th className="text-left  px-2 py-2 font-normal">Tier</th>
                <th className="text-left  px-2 py-2 font-normal">Status</th>
                <th className="text-center px-2 py-2 font-normal" title="Admin">A</th>
                <th className="text-center px-2 py-2 font-normal" title="Concierge">C</th>
                <th className="text-left  px-2 py-2 font-normal">Managed by</th>
                <th className="text-left  px-2 py-2 font-normal" title="Relationship manager">RM</th>
                <th className="text-right px-3 py-2 font-normal">Joined</th>
                <th className="text-right px-2 py-2 font-normal" title="Resend login email"></th>
                <th className="text-right px-2 py-2 font-normal" title="Delete user"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(m => (
                <tr key={m.email} className="border-t border-ee-border/60 align-middle">
                  <td className="px-3 py-2 max-w-[14rem]">
                    <p className="text-ee-primary truncate text-[13px]">{m.name ?? m.email.split('@')[0]}</p>
                    <p className="text-[11px] text-ee-muted truncate">{m.email}</p>
                    {m.firm && <p className="text-[10px] text-ee-muted/70 truncate">{m.firm}</p>}
                  </td>
                  <td className="px-2 py-2 text-ee-muted whitespace-nowrap text-xs">
                    {m.role === 'angel' ? 'Angel' : m.role === 'family_office' ? 'FO' : '—'}
                  </td>
                <td className="px-2 py-2">
                  {m.userId ? (
                    <TierAssignment
                      userId={m.userId}
                      current={m.membership}
                      disabled={!m.togglable}
                      disabledReason={m.toggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLES[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  {m.userId ? (
                    <AdminToggle
                      userId={m.userId}
                      initial={m.isAdmin}
                      selfUserId={selfUserId}
                      disabled={!m.staffTogglable}
                      disabledReason={m.staffToggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {m.userId ? (
                    <ConciergeToggle
                      userId={m.userId}
                      initial={m.isConcierge}
                      disabled={!m.staffTogglable}
                      disabledReason={m.staffToggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic" title="Profile not created yet">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
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
                <td className="px-2 py-2">
                  {m.userId && !m.isConcierge ? (
                    <RmAssignment
                      userId={m.userId}
                      current={m.relationshipManagerId}
                      concierges={concierges}
                      disabled={!m.staffTogglable}
                      disabledReason={m.staffToggleReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/50 italic"
                      title={m.isConcierge ? 'Concierges are RMs, not RM recipients' : 'Profile not created yet'}>
                      —
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-ee-muted text-xs whitespace-nowrap">{fmtDate(m.joined)}</td>
                <td className="px-2 py-2 text-right">
                  {m.deleteId ? (
                    <ResendLoginButton
                      userId={m.deleteId}
                      email={m.email}
                      disabled={!m.resendable}
                      disabledReason={m.resendReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/40 italic" title="No Cognito sign-in">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  {m.deleteId ? (
                    <DeleteUserButton
                      userId={m.deleteId}
                      email={m.email}
                      disabled={!m.deletable}
                      disabledReason={m.deleteReason}
                    />
                  ) : (
                    <span className="text-xs text-ee-muted/40 italic" title="No Cognito user or profile">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

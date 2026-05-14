'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import NotificationsBell from './NotificationsBell'

interface ShellUser {
  fullName: string
  role:     'angel' | 'family_office'
  isAdmin:  boolean
}

interface NavItem {
  href:  string
  icon:  string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   icon: 'dashboard',              label: 'Dashboard'  },
  { href: '/discovery',   icon: 'explore',                label: 'Discovery'  },
  { href: '/connections', icon: 'handshake',              label: 'Deal Room'  },
  { href: '/portfolio',   icon: 'account_balance_wallet', label: 'Portfolio'  },
  { href: '/network',     icon: 'group',                  label: 'Network'    },
  { href: '/reports',     icon: 'bar_chart',              label: 'Reports'    },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-data text-[11px] font-semibold tracking-widest uppercase transition-all ${
        active
          ? 'bg-ee-gold/10 text-ee-gold border-r-2 border-ee-gold'
          : 'text-ee-muted hover:bg-ee-surface-mid hover:text-ee-primary'
      }`}
    >
      <span
        className="material-symbols-outlined text-lg"
        style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" } : undefined}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  )
}

export default function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAngel  = user.role === 'angel'
  const roleIcon = isAngel ? 'person_raised_hand' : 'account_balance'
  const roleLabel = isAngel ? 'Angel Investor' : 'Family Office'
  const initial  = (user.fullName || '?')[0].toUpperCase()

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-ee-surface-low/90 backdrop-blur-md border-b border-ee-outline/40 z-50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-1 -ml-1 text-ee-muted hover:text-ee-primary"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <Link href="/dashboard" className="flex items-center shrink-0">
            <img src="/logo.png" alt="Equitas Elite" className="h-9 w-auto rounded-md" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.slice(0, 5).map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-data text-[11px] font-semibold tracking-widest uppercase px-3 py-1.5 transition-colors ${
                    active ? 'text-ee-gold border-b-2 border-ee-gold' : 'text-ee-muted hover:text-ee-primary'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user.isAdmin && (
            <Link
              href="/admin"
              className="hidden sm:flex h-8 px-3 items-center gap-1.5 bg-ee-gold/15 border border-ee-gold/30 text-ee-gold font-data text-[10px] font-bold tracking-widest uppercase rounded-lg hover:bg-ee-gold/25 transition-all"
            >
              <span className="material-symbols-outlined text-sm">shield_person</span>
              Admin
            </Link>
          )}
          <NotificationsBell />
          <Link
            href="/profile"
            className="p-2 hover:bg-ee-surface-mid rounded-lg transition-colors"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined text-ee-muted text-xl">settings</span>
          </Link>
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-ee-gold/20 border border-ee-gold/40 flex items-center justify-center"
            aria-label="Profile"
          >
            <span className="font-data text-[12px] font-bold text-ee-gold">{initial}</span>
          </Link>
        </div>
      </header>

      {/* Left sidebar (desktop) */}
      <aside className="fixed left-0 top-14 bottom-0 w-60 bg-ee-surface-low border-r border-ee-outline/40 hidden lg:flex flex-col z-40">
        <div className="p-4 border-b border-ee-outline/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ee-gold/20 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-ee-gold"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
              >
                {roleIcon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ee-primary truncate">{user.fullName}</p>
              <p className="font-data text-[10px] tracking-wider text-ee-gold uppercase">{roleLabel}</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-grow">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="p-3 space-y-1 border-t border-ee-outline/30">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-data text-[11px] font-semibold tracking-widest uppercase text-ee-muted hover:bg-ee-surface-mid hover:text-ee-primary transition-all"
          >
            <span className="material-symbols-outlined text-lg">settings</span>Settings
          </Link>
          <a
            href="/api/auth/signout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-data text-[11px] font-semibold tracking-widest uppercase text-ee-muted hover:bg-ee-surface-mid hover:text-ee-primary transition-all"
          >
            <span className="material-symbols-outlined text-lg">logout</span>Sign out
          </a>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-14 bottom-0 w-72 bg-ee-surface-low border-r border-ee-outline/40 z-50 flex flex-col">
            <div className="p-4 border-b border-ee-outline/30">
              <p className="text-[13px] font-semibold text-ee-primary truncate">{user.fullName}</p>
              <p className="font-data text-[10px] tracking-wider text-ee-gold uppercase">{roleLabel}</p>
            </div>
            <nav className="flex flex-col gap-0.5 p-3 flex-grow">
              {NAV_ITEMS.map(item => (
                <div key={item.href} onClick={() => setMobileOpen(false)}>
                  <NavLink item={item} active={pathname === item.href} />
                </div>
              ))}
            </nav>
            <div className="p-3 space-y-1 border-t border-ee-outline/30">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-data text-[11px] font-semibold tracking-widest uppercase text-ee-muted hover:bg-ee-surface-mid hover:text-ee-primary"
              >
                <span className="material-symbols-outlined text-lg">settings</span>Settings
              </Link>
              <a
                href="/api/auth/signout"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-data text-[11px] font-semibold tracking-widest uppercase text-ee-muted hover:bg-ee-surface-mid hover:text-ee-primary"
              >
                <span className="material-symbols-outlined text-lg">logout</span>Sign out
              </a>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="pt-14 lg:pl-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}

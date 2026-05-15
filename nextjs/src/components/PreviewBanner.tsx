'use client'

import { useState } from 'react'

interface Props {
  viewingAsName: string
  viewingAsRole: 'angel' | 'family_office'
}

// Persistent banner shown at the top of every (app) page while the
// visitor is in investor-preview mode. Makes it unmistakable that they
// are browsing demo data, and offers a one-click exit that clears the
// ee_preview cookie and bounces them to the marketing site.
export default function PreviewBanner({ viewingAsName, viewingAsRole }: Props) {
  const [busy, setBusy] = useState(false)

  async function exit() {
    setBusy(true)
    try {
      await fetch('/api/preview/clear', { method: 'POST' })
    } catch { /* ignore */ }
    window.location.href = '/'
  }

  const roleLabel = viewingAsRole === 'angel' ? 'Angel investor' : 'Family office'

  return (
    <div className="fixed top-0 left-0 right-0 h-9 bg-ee-gold/15 border-b border-ee-gold/40 z-[60] flex items-center justify-between px-4 md:px-6 text-xs">
      <span className="text-ee-gold flex items-center gap-2 min-w-0">
        <span
          className="material-symbols-outlined text-base shrink-0"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
        >
          visibility
        </span>
        <span className="truncate">
          Investor preview — viewing as <strong>{viewingAsName}</strong>{' '}
          <span className="hidden sm:inline">({roleLabel}, demo profile)</span>
        </span>
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        className="font-data uppercase tracking-widest text-[10px] text-ee-gold hover:underline whitespace-nowrap disabled:opacity-50"
      >
        Exit preview
      </button>
    </div>
  )
}

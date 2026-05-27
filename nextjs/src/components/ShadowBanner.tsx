'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// P5b — Shadow-view banner. Renders at the top of every read surface
// that pivots when a next-gen is in shadow mode (dashboard, deals,
// connections, match/[id]). The Exit button issues DELETE
// /api/me/shadow, which clears the cookie + bounces the next request
// back to the next-gen's own data.
//
// Visual contract: gold border + gold accent type, so it reads as an
// "elevated identity context" — distinct from the neutral page chrome
// and the emerald positive-action chrome. The read-only call-out is
// load-bearing copy: middleware does the actual block, but the user
// needs to be told why their attempts to interact won't work.

interface Props {
  parentName: string
  parentFirm: string
}

export default function ShadowBanner({ parentName, parentFirm }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function exit() {
    setBusy(true)
    try {
      await fetch('/api/me/shadow', { method: 'DELETE' })
    } finally {
      // Re-fetch the server-rendered surface. The cookie is gone so
      // getShadowState() returns null and reads pivot back to the
      // next-gen's own data. router.refresh() is sufficient; no full
      // navigation needed.
      router.refresh()
      setBusy(false)
    }
  }

  return (
    <aside
      role="status"
      aria-label="Shadow view active"
      className="rounded-lg border border-ee-gold/40 bg-ee-gold/5 p-3 flex items-start justify-between gap-4 flex-wrap"
    >
      <div className="min-w-0">
        <p className="font-data text-[10px] tracking-[0.12em] text-ee-gold uppercase">
          Viewing as
        </p>
        <p className="text-ee-primary mt-0.5 text-sm truncate">
          {parentName}
          <span className="text-ee-muted"> — {parentFirm}</span>
        </p>
        <p className="text-[11px] text-ee-muted mt-1">
          Read-only. Exit shadow view to make changes.
        </p>
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        className="shrink-0 text-[11px] font-data uppercase tracking-widest px-3 py-1.5 rounded-md border border-ee-gold/40 text-ee-gold hover:bg-ee-gold/10 transition-colors disabled:opacity-50"
      >
        {busy ? 'Exiting…' : 'Exit'}
      </button>
    </aside>
  )
}

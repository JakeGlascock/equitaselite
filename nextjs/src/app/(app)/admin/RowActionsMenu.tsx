'use client'

import { useState, useEffect, useRef } from 'react'
import DeleteUserButton from './DeleteUserButton'
import ResendLoginButton from './ResendLoginButton'

interface Props {
  deleteId:        string | null
  email:           string
  deletable:       boolean
  deleteReason?:   string
  resendable:      boolean
  resendReason?:   string
}

// Kebab-menu wrapper around the row's destructive + recovery actions.
// Click the `⋮` to open a dropdown that hosts ResendLoginButton and
// DeleteUserButton — each of those keeps its own two-step confirm UX,
// so destructive actions still take two intentional clicks.
//
// Click-outside + Escape close the menu. Nothing fancy — no portal,
// no z-index gymnastics; the menu opens absolute-positioned to the
// right of the button.
export default function RowActionsMenu(props: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (!props.deleteId) {
    return (
      <span className="text-xs text-ee-muted/40 italic" title="No Cognito user or profile">—</span>
    )
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-ee-muted/60 hover:text-ee-primary inline-flex items-center justify-center"
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-base leading-none">more_horiz</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 z-20 glass-panel p-2 space-y-1"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5">
            <span className="text-xs text-ee-primary">Resend login email</span>
            <ResendLoginButton
              userId={props.deleteId}
              email={props.email}
              disabled={!props.resendable}
              disabledReason={props.resendReason}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-red-500/5">
            <span className="text-xs text-ee-primary">Delete user</span>
            <DeleteUserButton
              userId={props.deleteId}
              email={props.email}
              disabled={!props.deletable}
              disabledReason={props.deleteReason}
            />
          </div>
        </div>
      )}
    </div>
  )
}

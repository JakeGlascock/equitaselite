'use client'

import { useState } from 'react'
import { haptic, saveContact } from '@/lib/native'

interface Props {
  name:  string
  firm:  string
  email: string
}

// Action cluster for an accepted introduction row: the Email button
// (works everywhere via mailto:) plus a Save-to-Contacts button that
// only renders inside the Capacitor wrapper. Detection is sync via
// window.Capacitor — same guard as lib/native — so SSR + plain web
// see only the email button and the bundle stays tiny.
function isNativeSync(): boolean {
  if (typeof window === 'undefined') return false
  type Cap = { isNativePlatform?: () => boolean }
  return (window as unknown as { Capacitor?: Cap }).Capacitor?.isNativePlatform?.() === true
}

export default function AcceptedActions({ name, firm, email }: Props) {
  const [savedState, setSavedState] = useState<'idle' | 'saving' | 'saved' | 'denied'>('idle')
  const firstName = name.split(' ')[0] || name

  async function onSave() {
    if (savedState === 'saving' || savedState === 'saved') return
    setSavedState('saving')
    const ok = await saveContact({
      fullName: name,
      email,
      firm,
      note: 'Met via Equitas Elite',
    })
    if (ok) {
      void haptic('success')
      setSavedState('saved')
    } else {
      setSavedState('denied')
    }
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <a
        href={`mailto:${email}`}
        onClick={() => void haptic('light')}
        className="text-xs px-3 py-1.5 rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 whitespace-nowrap"
      >
        Email {firstName}
      </a>
      {isNativeSync() && (
        <button
          type="button"
          onClick={onSave}
          disabled={savedState === 'saving' || savedState === 'saved'}
          title={
            savedState === 'saved'  ? 'Saved to Contacts'
            : savedState === 'denied' ? 'Contacts permission denied'
            : 'Save to Contacts'
          }
          aria-label={savedState === 'saved' ? 'Saved to Contacts' : 'Save to Contacts'}
          className="text-xs w-8 h-8 grid place-items-center rounded-full border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald hover:brightness-110 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base">
            {savedState === 'saved' ? 'check' : 'person_add'}
          </span>
        </button>
      )}
    </div>
  )
}

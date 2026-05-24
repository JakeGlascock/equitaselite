'use client'

import { useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

// Password input with a Show/Hide toggle so the user can visually verify
// what they're typing. Toggle is a real <button> so it's keyboard
// reachable; uses font-data text (not an icon) to stay within the
// existing Material Symbols subset — adding a new glyph would require
// regenerating the woff2.
export default function PasswordField(props: Props) {
  const [show, setShow] = useState(false)
  const { className = '', ...rest } = props
  return (
    <div className="relative">
      <input
        {...rest}
        type={show ? 'text' : 'password'}
        className={`input-field pr-16 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ee-muted hover:text-ee-primary uppercase tracking-widest font-data"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

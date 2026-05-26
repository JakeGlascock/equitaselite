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
      {/* min-h-6 + px/py give a 24x24 minimum touch target (WCAG 2.2
          target-size, 24x24 CSS px). The visible text remains 10px,
          but the click hitbox now meets the standard. */}
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 min-h-6 px-2 py-1 text-[10px] text-ee-muted hover:text-ee-primary uppercase tracking-widest font-data inline-flex items-center justify-center"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

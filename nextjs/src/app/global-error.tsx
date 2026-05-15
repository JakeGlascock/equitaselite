'use client'

import Link from 'next/link'
import ErrorReportForm from '@/components/ErrorReportForm'

// Catches uncaught errors at the root of the app (including failures
// inside the root layout that prevent global styles from loading). Has
// its own <html> + <body> per Next.js requirements, with inline styles
// rather than Tailwind classes — if a class-stylesheet failure caused
// the error, we still need to render something readable.
//
// Replaces the default Next.js "Application error: a server-side
// exception has occurred" page (the one with the bare digest), which
// is what the user saw on their first preview-link attempt.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{
        margin:         0,
        padding:        0,
        background:     '#031427',
        color:          '#bec6e0',
        fontFamily:     'Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif',
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <div style={{
          maxWidth:        448,
          width:           '100%',
          margin:          '0 20px',
          padding:         32,
          background:      'rgba(16, 32, 52, 0.6)',
          backdropFilter:  'blur(12px)',
          border:          '1px solid rgba(69, 70, 77, 0.5)',
          borderRadius:    12,
          textAlign:       'center',
        }}>
          <p style={{
            fontFamily:     'IBM Plex Mono, monospace',
            fontSize:       10,
            letterSpacing:  '0.2em',
            textTransform:  'uppercase',
            color:          '#e9c176',
            margin:         '0 0 12px 0',
          }}>
            Equitas Elite
          </p>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, Playfair Display, Georgia, serif',
            fontSize:   28,
            fontWeight: 500,
            color:      '#bec6e0',
            margin:     '0 0 12px 0',
          }}>
            Something broke.
          </h1>
          <p style={{ fontSize: 14, color: '#8892a4', margin: '0 0 8px 0', lineHeight: 1.5 }}>
            An unexpected error stopped this page from loading. Refreshing usually works.
          </p>
          {error.digest && (
            <p style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize:   11,
              color:      '#45464d',
              margin:     '4px 0 0 0',
            }}>
              Reference: <span style={{ color: '#8892a4' }}>{error.digest}</span>
            </p>
          )}
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background:    '#e9c176',
                color:         '#031427',
                border:        'none',
                fontWeight:    600,
                fontSize:      13,
                padding:       '10px 18px',
                borderRadius:  8,
                cursor:        'pointer',
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                color:           '#bec6e0',
                textDecoration:  'none',
                fontSize:        13,
                padding:         '10px 18px',
                border:          '1px solid rgba(255,255,255,0.12)',
                borderRadius:    8,
              }}
            >
              Go home
            </Link>
          </div>
          <ErrorReportForm digest={error.digest} />
        </div>
      </body>
    </html>
  )
}

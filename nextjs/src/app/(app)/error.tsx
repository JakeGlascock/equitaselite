'use client'

import Link from 'next/link'
import ErrorReportForm from '@/components/ErrorReportForm'

// Catches errors thrown inside any (app) route. Inherits the app shell
// (top nav, sidebar) so the user keeps their navigation context — only
// the page content slot renders the error panel.
//
// global-error.tsx handles the heavier case where the layout itself
// failed to render.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="px-5 md:px-8 py-8">
      <div className="max-w-md mx-auto glass-panel p-8 text-center space-y-3">
        <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-gold">Something broke</p>
        <h1 className="font-display text-2xl text-ee-primary">This page didn&apos;t load</h1>
        <p className="text-sm text-ee-muted leading-relaxed">
          An unexpected error stopped this view from rendering. Refreshing usually works.
        </p>
        {error.digest && (
          <p className="font-data text-[10px] text-ee-muted">
            Reference: <span className="text-ee-primary">{error.digest}</span>
          </p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-gold text-xs"
          >
            Try again
          </button>
          <Link href="/dashboard" className="btn-ghost text-xs">
            Back to dashboard
          </Link>
        </div>
        <ErrorReportForm digest={error.digest} />
      </div>
    </main>
  )
}

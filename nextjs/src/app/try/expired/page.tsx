import Link from 'next/link'

export const metadata = {
  title:       'Link expired — Equitas Elite',
  description: 'Your walkthrough link is no longer valid.',
}

const REASON_COPY: Record<string, { heading: string; body: string }> = {
  expired:         { heading: 'Link expired',  body: 'This walkthrough link is past its 30-minute window. Request a fresh one and you&rsquo;ll be on your way.' },
  used:            { heading: 'Link already used', body: 'This link was already opened. For security, each walkthrough link works once. Request a fresh one to start a new session.' },
  not_found:       { heading: 'Link not found', body: 'This walkthrough link isn&rsquo;t in our system. The token may be mistyped or the email may have been forwarded from an old request.' },
  bad_role:        { heading: 'Demo unavailable', body: 'The role context for this walkthrough isn&rsquo;t supported. Request a new demo and pick a different option.' },
  no_demo_profile: { heading: 'Demo unavailable', body: 'No matching demo profile is currently configured. Our team has been notified — please try a different role, or come back shortly.' },
  mint_failed:     { heading: 'Something went wrong', body: 'We couldn&rsquo;t start your walkthrough. Refresh and request a fresh link, and the issue should resolve.' },
}
const DEFAULT_COPY = REASON_COPY.not_found

export default async function ExpiredPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  const copy = (reason && REASON_COPY[reason]) || DEFAULT_COPY

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <p className="font-data text-[10px] tracking-[0.15em] uppercase text-ee-muted">Equitas Elite</p>
        <h1 className="font-display text-3xl text-ee-gold mt-3">{copy.heading}</h1>
        <p className="text-ee-muted text-sm mt-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: copy.body }} />
        <div className="mt-8 flex flex-col gap-2 items-center">
          <Link href="/try" className="btn-gold inline-block">
            Request a new walkthrough
          </Link>
          <Link href="/" className="text-xs text-ee-muted hover:text-ee-primary mt-1">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}

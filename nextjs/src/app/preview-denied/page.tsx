import Link from 'next/link'
import ErrorReportForm from '@/components/ErrorReportForm'

export const dynamic = 'force-dynamic'

const COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: 'Link not found',
    body:  'This preview link is no longer valid. Ask the person who shared it for a new one.',
  },
  revoked: {
    title: 'Link revoked',
    body:  'This preview link has been revoked. Reach out for a fresh one.',
  },
  expired: {
    title: 'Link expired',
    body:  'This preview link has expired. Ask for a new one — they\'re quick to issue.',
  },
  exhausted: {
    title: 'View limit reached',
    body:  'This preview link has been used too many times. Ask for a new one.',
  },
}

export default async function PreviewDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const { title, body } = COPY[reason ?? 'not_found'] ?? COPY.not_found

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="glass-panel max-w-md w-full p-8 text-center space-y-3">
        <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-gold">Equitas Elite</p>
        <h1 className="font-display text-2xl text-ee-primary">{title}</h1>
        <p className="text-sm text-ee-muted leading-relaxed">{body}</p>
        <p className="pt-4">
          <Link href="/" className="font-data text-[11px] tracking-widest uppercase text-ee-gold hover:underline">
            Back to home
          </Link>
        </p>
        <ErrorReportForm
          path="/preview-denied"
          context={{ reason: reason ?? 'not_found' }}
        />
      </div>
    </main>
  )
}

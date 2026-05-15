import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { getBriefingForReader } from '@/lib/portfolio-reports'

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')

  // Staff (admin or concierge) can read any briefing for QA. The
  // recipient gets their own. Anyone else hits notFound.
  const isAdmin = await isUserAdmin(userId, userEmail)
  let isConcierge = false
  if (!isAdmin) {
    const r = await queryOne<{ is_concierge: boolean | null }>(
      'SELECT is_concierge FROM profiles WHERE id = $1',
      [userId],
    ).catch(() => null)
    isConcierge = !!r?.is_concierge
  }
  const isStaff = isAdmin || isConcierge

  const { id } = await params
  const briefing = await getBriefingForReader(id, userId, isStaff)
  if (!briefing) notFound()

  return (
    <article className="px-5 md:px-8 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/concierge" className="text-[11px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold transition-colors">
          ← Concierge
        </Link>

        <header className="space-y-3">
          <p className="font-data text-[10px] tracking-[0.12em] uppercase text-ee-gold">Bespoke briefing</p>
          <h1 className="font-display text-3xl md:text-4xl text-ee-primary leading-tight">
            {briefing.title}
          </h1>
          <p className="text-ee-muted text-sm">{fmtDate(briefing.published_at)}</p>
          <p className="text-ee-muted text-base md:text-lg leading-relaxed">
            {briefing.summary}
          </p>
        </header>

        <hr className="border-ee-border/40" />

        {briefing.body_html ? (
          <div
            className="report-body text-ee-primary"
            dangerouslySetInnerHTML={{ __html: briefing.body_html }}
          />
        ) : (
          <pre className="text-ee-primary whitespace-pre-wrap font-body">{briefing.body}</pre>
        )}
      </div>
    </article>
  )
}

import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTier } from '@/lib/membership'
import { getReportForReader } from '@/lib/reports'

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  const { slug } = await params
  const tier = await getTier(userId)
  const report = await getReportForReader(slug, tier)
  if (!report) notFound()

  return (
    <article className="px-5 md:px-8 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/reports" className="text-[11px] font-data uppercase tracking-widest text-ee-muted hover:text-ee-gold transition-colors">
          ← All reports
        </Link>

        <header className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-widest">
            <span className="text-ee-gold">{report.sector_tag}</span>
            <span className="text-ee-muted/40">·</span>
            <span className="text-ee-muted">{fmtDate(report.published_at)}</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-ee-primary leading-tight">
            {report.title}
          </h1>
          <p className="text-ee-muted text-base md:text-lg leading-relaxed">
            {report.summary}
          </p>
        </header>

        <hr className="border-ee-border/40" />

        {report.body_html ? (
          <div
            className="report-body text-ee-primary"
            dangerouslySetInnerHTML={{ __html: report.body_html }}
          />
        ) : (
          <pre className="text-ee-primary whitespace-pre-wrap font-body">{report.body}</pre>
        )}
      </div>
    </article>
  )
}

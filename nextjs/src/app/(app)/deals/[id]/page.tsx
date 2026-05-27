import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import { getTier } from '@/lib/membership'
import {
  getDeal,
  isMemberOfDealRoom,
  listDealMessages,
  type Deal,
  type DealMessage,
} from '@/lib/deals'
import { isUserAdmin } from '@/lib/admin'
import { queryOne } from '@/lib/db'
import DealDiscussion from './DealDiscussion'

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtMoney(n: number | null): string {
  if (n === null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// P4 — per-deal room. Server component renders the deal header +
// existing concierge note (from P3) and hands the discussion thread
// off to a client component so members can post without a reload.
export default async function DealRoomPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const h = await headers()
  const userId    = h.get('x-user-id')
  const userEmail = h.get('x-user-email')
  if (!userId) redirect('/signin')

  const tier  = await getTier(userId)
  const admin = await isUserAdmin(userId, userEmail)

  // Hard gate: must be in the room. Admins always pass. Non-admin
  // viewers must be on the invitations table OR be the deal's
  // created_by (a concierge can see the rooms they set up).
  const isMember = await isMemberOfDealRoom(id, userId)
  if (!isMember && !admin) {
    // Tier check is informational only here — the real gate is
    // membership in this specific room. Non-Sovereigns shouldn't
    // even see /deals listing, so this branch is mostly an admin/
    // concierge cross-walk.
    if (tier !== 'sovereign') redirect('/deals')
    notFound()
  }

  const deal = await getDeal(id)
  if (!deal) notFound()

  const messages = await listDealMessages(id).catch(() => [] as DealMessage[])

  // Joined author name for the concierge note, mirroring the
  // listInvitationsForUser shape so the page can render the same
  // <aside> block as the /deals listing.
  const authorRow = deal.concierge_note_author_id
    ? await queryOne<{ full_name: string | null }>(
        `SELECT full_name FROM profiles WHERE id = $1`,
        [deal.concierge_note_author_id],
      ).catch(() => null)
    : null

  const html = marked.parse(deal.description, { async: false }) as string
  const isModerator = admin || deal.created_by === userId

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/deals" className="text-xs text-ee-muted hover:text-ee-primary inline-block">
          ← Back to deal flow
        </Link>

        <DealHeader deal={deal} fmtDate={fmtDate} fmtMoney={fmtMoney} />

        <article className="glass-panel p-6 space-y-4">
          <div
            className="prose prose-invert prose-sm max-w-none text-ee-primary [&_p]:text-ee-primary [&_li]:text-ee-primary [&_a]:text-ee-gold"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* P3 — concierge note (rendered same as on /deals listing) */}
          {deal.concierge_note && (
            <aside
              role="note"
              aria-label="Concierge note"
              className="rounded-lg border border-ee-gold/40 bg-ee-gold/5 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">
                  Concierge note
                  {authorRow?.full_name && (
                    <span className="text-ee-muted normal-case tracking-normal font-normal ml-2">
                      · from {authorRow.full_name}
                    </span>
                  )}
                </p>
                {deal.concierge_note_updated_at && (
                  <p className="text-[10px] text-ee-muted">{fmtDate(deal.concierge_note_updated_at)}</p>
                )}
              </div>
              <p className="text-sm text-ee-primary italic whitespace-pre-line">
                {deal.concierge_note}
              </p>
            </aside>
          )}
        </article>

        {/* P4 — the room itself */}
        <DealDiscussion
          dealId={id}
          initialMessages={messages}
          currentUserId={userId}
          isModerator={isModerator}
        />
      </div>
    </div>
  )
}

function DealHeader({
  deal, fmtDate, fmtMoney,
}: { deal: Deal; fmtDate: (s: string) => string; fmtMoney: (n: number | null) => string }) {
  return (
    <div className="space-y-2">
      <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Deal room</p>
      <h1 className="font-display text-3xl text-ee-gold">{deal.title}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ee-muted">
        {deal.sectors.length > 0 && <span>{deal.sectors.join(' · ')}</span>}
        {deal.stages.length  > 0 && <span>{deal.stages.join(' · ')}</span>}
        {(deal.check_size_min || deal.check_size_max) && (
          <span>
            Check: {fmtMoney(deal.check_size_min)}
            {deal.check_size_min && deal.check_size_max ? ' – ' : ''}
            {fmtMoney(deal.check_size_max)}
          </span>
        )}
        {deal.geography && <span>{deal.geography}</span>}
        <span>Opened {fmtDate(deal.created_at)}</span>
      </div>
    </div>
  )
}

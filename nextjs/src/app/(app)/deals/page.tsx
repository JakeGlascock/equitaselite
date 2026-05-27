import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import { getTier } from '@/lib/membership'
import { listInvitationsForUser } from '@/lib/deals'
import { getShadowState } from '@/lib/shadow'
import ShadowBanner from '@/components/ShadowBanner'
import DealResponseControls from './DealResponseControls'

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number | null): string {
  if (n === null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default async function DealsPage() {
  const h = await headers()
  const actualUserId = h.get('x-user-id')
  if (!actualUserId) redirect('/signin')

  // P5b — pivot to parent's seat for the deals listing when a next-gen
  // is in shadow mode. Tier gate ALSO pivots so a next-gen shadowing a
  // Sovereign parent sees the parent's invitations, not a /pricing
  // upsell.
  const shadow = await getShadowState()
  const userId = shadow?.parentId ?? actualUserId
  const tier = await getTier(userId)
  if (tier !== 'sovereign') {
    return (
      <div className="px-5 md:px-8 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Sovereign tier</p>
          <h1 className="font-display text-3xl text-ee-gold">Exclusive deal flow</h1>
          <p className="text-ee-muted text-sm">
            Curated investment opportunities are available to Sovereign-tier members. Upgrade your membership to see deals you&rsquo;ve been invited to.
          </p>
          <Link href="/pricing" className="btn-gold inline-block text-xs mt-2">
            View Sovereign tier →
          </Link>
        </div>
      </div>
    )
  }

  const invitations = await listInvitationsForUser(userId).catch(() => [])

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {shadow && (
          <ShadowBanner
            parentName={shadow.parentProfile.full_name}
            parentFirm={shadow.parentProfile.firm_name}
          />
        )}
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Curated for you</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Deal flow</h1>
          <p className="text-ee-muted text-sm mt-1">
            Hand-picked opportunities matched to your mandates. Express interest and we&rsquo;ll broker the introduction directly.
          </p>
        </div>

        {invitations.length === 0 ? (
          <div className="glass-panel p-8 text-center space-y-2">
            <p className="font-display text-lg text-ee-primary">No active invitations.</p>
            <p className="text-ee-muted text-sm">
              We&rsquo;ll send you a curated opportunity when one matches your mandate. You can also email <a href="mailto:concierge@equitaselite.com" className="text-ee-gold underline">concierge@equitaselite.com</a> to refine what you&rsquo;d like to see.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map(inv => {
              const d = inv.deal
              const html = marked.parse(d.description, { async: false }) as string
              return (
                <article key={inv.id} className="glass-panel p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-display text-xl text-ee-primary">
                        <Link href={`/deals/${d.id}`} className="hover:text-ee-gold transition-colors">
                          {d.title}
                        </Link>
                      </h2>
                      <p className="text-[10px] font-data uppercase tracking-widest text-ee-muted mt-1.5">
                        Invited {fmtDate(inv.invited_at)}
                        <Link
                          href={`/deals/${d.id}`}
                          className="text-ee-gold hover:underline normal-case tracking-normal ml-3"
                        >Open room →</Link>
                      </p>
                    </div>
                    {inv.status !== 'pending' && (
                      <span className={`text-[10px] font-data uppercase tracking-widest px-2 py-1 rounded ${inv.status === 'interested' ? 'bg-ee-emerald/10 text-ee-emerald' : 'bg-ee-muted/10 text-ee-muted'}`}>
                        {inv.status === 'interested' ? 'You expressed interest' : 'You passed'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ee-muted">
                    {d.sectors.length > 0 && <span>{d.sectors.join(' · ')}</span>}
                    {d.stages.length  > 0 && <span>{d.stages.join(' · ')}</span>}
                    {(d.check_size_min || d.check_size_max) && (
                      <span>
                        Check: {fmtMoney(d.check_size_min)}
                        {d.check_size_min && d.check_size_max ? ' – ' : ''}
                        {fmtMoney(d.check_size_max)}
                      </span>
                    )}
                    {d.geography && <span>{d.geography}</span>}
                  </div>

                  <div
                    className="prose prose-invert prose-sm max-w-none text-ee-primary [&_p]:text-ee-primary [&_li]:text-ee-primary [&_a]:text-ee-gold"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />

                  {/* P3 — concierge note on the deal. Rendered as a
                      visually-distinct gold block + explicit attribution
                      so it doesn't blur into the deal listing's neutral
                      algorithm-shaped chrome. See feedback memory
                      `feedback-two-trust-layers` for why this is kept
                      explicitly separate. */}
                  {d.concierge_note && (
                    <aside
                      role="note"
                      aria-label="Concierge note"
                      className="rounded-lg border border-ee-gold/40 bg-ee-gold/5 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold">
                          Concierge note
                          {d.concierge_note_author_name && (
                            <span className="text-ee-muted normal-case tracking-normal font-normal ml-2">
                              · from {d.concierge_note_author_name}
                            </span>
                          )}
                        </p>
                        {d.concierge_note_updated_at && (
                          <p className="text-[10px] text-ee-muted">
                            {fmtDate(d.concierge_note_updated_at)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-ee-primary italic whitespace-pre-line">
                        {d.concierge_note}
                      </p>
                    </aside>
                  )}

                  {/* Hide the express-interest controls during shadow
                      view. Middleware would 403 the POST anyway, but
                      showing a clickable button you can't use is a
                      worse experience than just hiding it. */}
                  {inv.status === 'pending' && !shadow && (
                    <DealResponseControls invitationId={inv.id} />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

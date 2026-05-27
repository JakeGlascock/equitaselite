import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { getParent } from '@/lib/family'
import { getShadowState } from '@/lib/shadow'
import EnterShadowButton from './EnterShadowButton'
import ShadowBanner from '@/components/ShadowBanner'

// P5b — Next-Gen shadow-view control surface. Renders the linked
// parent seat + an Enter / Exit toggle. v1 is intentionally tight:
// no activity-log viewer, no permission tuning (parent grants
// comment-only, etc.). Those are deferred to P5c — see the product
// phase plan memory.
//
// Authorisation:
//   - Page is only meaningful for next-gens with a parent_profile_id.
//   - A signed-in user without is_next_gen redirects to /profile.
//   - A signed-in next-gen without a parent sees an explanatory empty
//     state (admin-link path is in /admin).

export default async function FamilyPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  // Read just the role flag + a fast existence check via getParent.
  // Avoids loading the whole profile.
  const me = await queryOne<{ id: string; is_next_gen: boolean | null; full_name: string }>(
    `SELECT id, is_next_gen, full_name FROM profiles WHERE id = $1`,
    [userId],
  ).catch(() => null)

  if (!me) redirect('/onboarding')
  if (!me.is_next_gen) {
    // Not a next-gen — nothing to manage. Send them to /profile where
    // the parent-side "linked next-gen seats" panel lives.
    redirect('/profile')
  }

  const [parent, shadow] = await Promise.all([
    getParent(userId),
    getShadowState(),
  ])

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Next-Gen seat</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Family</h1>
          <p className="text-ee-muted text-sm mt-1">
            Manage your shadow view of the parent seat linked to your account.
          </p>
        </div>

        {/* While a shadow is active, the banner doubles as the exit
            control — it appears at the top of every pivoted surface
            (dashboard / deals / connections / match). Surfacing it
            here too keeps /family a single source of truth. */}
        {shadow && (
          <ShadowBanner
            parentName={shadow.parentProfile.full_name}
            parentFirm={shadow.parentProfile.firm_name}
          />
        )}

        {parent ? (
          <section className="glass-panel p-5 space-y-4" aria-labelledby="parent-heading">
            <div>
              <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">
                Linked parent seat
              </p>
              <h2 id="parent-heading" className="font-display text-lg text-ee-primary mt-1">
                {parent.full_name}
              </h2>
              <p className="text-sm text-ee-muted">{parent.firm_name}</p>
            </div>

            {/* When already shadowing, the Enter button is replaced
                by an inline state note so the page doesn't render two
                competing affordances. Exit lives in the banner above. */}
            {shadow ? (
              <p className="text-xs text-ee-muted italic">
                Shadow view is active. Use the Exit button above when you&rsquo;re done — or
                close the browser; the cookie expires after eight hours.
              </p>
            ) : (
              <EnterShadowButton parentFirstName={parent.full_name.split(' ')[0]} />
            )}

            <div className="text-[11px] text-ee-muted border-t border-ee-border pt-3 space-y-1">
              <p>
                <span className="text-ee-primary">What you can see:</span> {parent.full_name.split(' ')[0]}&rsquo;s
                dashboard, deal flow, introductions, and match detail pages.
              </p>
              <p>
                <span className="text-ee-primary">What stays yours:</span> your profile,
                your mandate, your notifications, your sign-in. Shadow view is read-only.
              </p>
              <p>
                <span className="text-ee-primary">{parent.full_name.split(' ')[0]} is notified</span> each
                time you enter shadow view.
              </p>
            </div>
          </section>
        ) : (
          <section className="glass-panel p-5 space-y-3">
            <h2 className="font-display text-lg text-ee-primary">
              No parent seat linked yet
            </h2>
            <p className="text-sm text-ee-muted">
              Once an EE administrator links you to a parent seat (Family Office,
              Family Foundation, or Donor-Advised Fund), you&rsquo;ll be able to view
              their deal flow alongside your own.
            </p>
            <p className="text-xs text-ee-muted">
              Reach out to your relationship manager or email
              <a href="mailto:concierge@equitaselite.com" className="text-ee-gold underline ml-1">
                concierge@equitaselite.com
              </a>.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

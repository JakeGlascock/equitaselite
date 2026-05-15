import { getTier, type Tier } from '@/lib/membership'
import { tryGetUserId } from '@/lib/session'
import PricingClient from './PricingClient'

// Pricing is reachable by both authenticated and unauthenticated visitors.
// For signed-in users we surface their current tier so the right card shows
// the "Current plan" badge and the back link points at /dashboard (not /signin).
//
// Middleware skips JWT verification on public routes, so x-user-id isn't
// set here even for authenticated users — tryGetUserId() decodes the
// ee_id cookie directly to recover the auth state.
export default async function PricingPage() {
  const userId = await tryGetUserId()
  const currentTier: Tier | null = userId ? await getTier(userId).catch(() => null) : null
  return <PricingClient currentTier={currentTier} />
}

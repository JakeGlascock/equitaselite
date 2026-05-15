import { getTier, type Tier } from '@/lib/membership'
import { tryGetUserId } from '@/lib/session'
import PricingClient from './PricingClient'

// Force per-request rendering. Without this, Next.js statically
// pre-generates /pricing at build time with currentTier=null baked in
// (tryGetUserId returns early when env vars are absent in the build
// context, so cookies() never runs and Next doesn't detect the
// dynamic-API signal). That cached HTML then serves to every visitor
// — including signed-in ones — making the back link always read
// "Back to sign in." force-dynamic makes the page render fresh on
// every request so the cookie read actually happens.
export const dynamic = 'force-dynamic'

// Pricing is reachable by both authenticated and unauthenticated visitors.
// For signed-in users we surface their current tier so the right card shows
// the "Current plan" badge and the back link points at /dashboard (not /signin).
export default async function PricingPage() {
  const userId = await tryGetUserId()
  const currentTier: Tier | null = userId ? await getTier(userId).catch(() => null) : null
  return <PricingClient currentTier={currentTier} />
}

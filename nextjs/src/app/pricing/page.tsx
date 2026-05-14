import { headers } from 'next/headers'
import { getTier, type Tier } from '@/lib/membership'
import PricingClient from './PricingClient'

// Pricing is reachable by both authenticated and unauthenticated visitors.
// For signed-in users we surface their current tier so the right card shows
// the "Current plan" badge and the CTAs reflect upgrade vs. request-access.
export default async function PricingPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  const currentTier: Tier | null = userId ? await getTier(userId) : null
  return <PricingClient currentTier={currentTier} />
}

import Link from 'next/link'
import { turnstileSiteKey } from '@/lib/turnstile'
import TryForm from './TryForm'

export const metadata = {
  title:       'Try Equitas Elite',
  description: 'Walk through the platform as any role — Angel, Family Office, Foundation, DAF, or Next Gen. Demo content only; no real-member data.',
}

export default function TryPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <Link href="/" className="font-data text-[10px] tracking-[0.15em] uppercase text-ee-muted hover:text-ee-primary">
            ← Equitas Elite
          </Link>
          <h1 className="font-display text-3xl text-ee-gold mt-3">Walk through the platform</h1>
          <p className="text-ee-muted text-sm mt-2 leading-relaxed">
            A private demo with curated counterparties. View as any role —
            Angel, Family Office, Foundation, DAF, or Next Gen — and see how
            mandate-aligned matches surface. No real-member data appears.
          </p>
        </div>

        <TryForm turnstileSiteKey={turnstileSiteKey()} />

        <p className="text-center text-[11px] text-ee-muted/70 mt-6 leading-relaxed">
          We email a one-time link to confirm your address before starting
          the demo. Your information is reviewed by our team and never
          shared. Already a member? <Link href="/signin" className="text-ee-gold hover:underline">Sign in</Link>.
        </p>
      </div>
    </main>
  )
}

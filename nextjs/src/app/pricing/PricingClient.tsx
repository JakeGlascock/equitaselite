'use client'

import { useState } from 'react'
import Link from 'next/link'

const ANNUAL_DISCOUNT = 0.20

type Tier = 'access' | 'select' | 'sovereign'

interface Plan {
  id:          Tier
  name:        string
  monthly:     number
  description: string
  cta:         string
  highlight:   boolean
  features:    { label: string; included: boolean }[]
}

const PLANS: Plan[] = [
  {
    id:          'access',
    name:        'Access',
    monthly:     1500,
    description: 'For investors beginning to explore curated deal flow.',
    cta:         'Request access',
    highlight:   false,
    features: [
      { label: 'Up to 10 curated matches / month',     included: true },
      { label: 'Match score breakdown',                included: true },
      { label: 'Standard profile placement',           included: true },
      { label: 'Email deal alerts',                    included: true },
      { label: 'Direct introduction requests',         included: false },
      { label: 'Sector intelligence reports',          included: false },
      { label: 'Dedicated onboarding support',         included: false },
      { label: 'Relationship manager',                 included: false },
      { label: 'Exclusive deal flow invitations',      included: false },
      { label: 'Annual summit invitation',             included: false },
    ],
  },
  {
    id:          'select',
    name:        'Select',
    monthly:     3750,
    description: 'For active deployers who want to move with conviction.',
    cta:         'Request access',
    highlight:   true,
    features: [
      { label: 'Unlimited curated matches',            included: true },
      { label: 'Advanced mandate analytics',           included: true },
      { label: 'Priority profile placement',           included: true },
      { label: 'Email deal alerts',                    included: true },
      { label: '5 direct introductions / month',       included: true },
      { label: 'Quarterly sector intelligence reports',included: true },
      { label: 'Dedicated onboarding support',         included: true },
      { label: 'Relationship manager',                 included: false },
      { label: 'Exclusive deal flow invitations',      included: false },
      { label: 'Annual summit invitation',             included: false },
    ],
  },
  {
    id:          'sovereign',
    name:        'Sovereign',
    monthly:     9500,
    description: 'White-glove service for principals who expect more — paired with a credentialed family office practitioner.',
    cta:         'Request access',
    highlight:   false,
    features: [
      { label: 'Unlimited curated matches',            included: true },
      { label: 'Advanced mandate analytics',           included: true },
      { label: 'Priority profile placement',           included: true },
      { label: 'Email deal alerts',                    included: true },
      { label: 'Unlimited direct introductions',       included: true },
      { label: 'Bespoke portfolio intelligence',       included: true },
      { label: 'Dedicated onboarding support',         included: true },
      { label: 'Dedicated relationship manager',       included: true },
      { label: 'Exclusive deal flow invitations',      included: true },
      { label: 'Annual summit invitation',             included: true },
    ],
  },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function CheckIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg className="w-4 h-4 shrink-0 text-ee-emerald" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-white/20" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function PricingClient({ currentTier }: { currentTier: Tier | null }) {
  const [annual, setAnnual] = useState(true)

  return (
    <main className="min-h-screen px-4 py-16">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <Link href={currentTier ? '/dashboard' : '/'} className="inline-block text-xs text-ee-muted hover:text-ee-primary transition-colors mb-2">
            ← {currentTier ? 'Back to dashboard' : 'Back to sign in'}
          </Link>
          <h1 className="font-display text-4xl text-ee-gold">Membership</h1>
          <p className="text-ee-muted max-w-md mx-auto">
            Curated capital meets verified mandate. Every tier is invitation-only.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 mt-6 bg-white/5 border border-ee-border rounded-full px-2 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1 rounded-full text-sm transition-all ${
                !annual ? 'bg-ee-gold text-ee-bg font-semibold' : 'text-ee-muted hover:text-ee-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1 rounded-full text-sm transition-all flex items-center gap-2 ${
                annual ? 'bg-ee-gold text-ee-bg font-semibold' : 'text-ee-muted hover:text-ee-primary'
              }`}
            >
              Annual
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                annual ? 'bg-ee-bg/30 text-ee-bg' : 'bg-ee-emerald/15 text-ee-emerald'
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(plan => {
            const price = annual
              ? Math.round(plan.monthly * (1 - ANNUAL_DISCOUNT))
              : plan.monthly
            const isCurrent = currentTier === plan.id

            return (
              <div
                key={plan.id}
                className={`glass-panel p-8 flex flex-col gap-6 relative ${
                  isCurrent
                    ? 'border-ee-emerald/60 shadow-[0_0_40px_rgba(78,222,163,0.12)]'
                    : plan.highlight
                      ? 'border-ee-gold/50 shadow-[0_0_40px_rgba(233,193,118,0.08)]'
                      : ''
                }`}
              >
                {isCurrent ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-ee-emerald text-ee-bg text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      Current plan
                    </span>
                  </div>
                ) : plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-ee-gold text-ee-bg text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      Most popular
                    </span>
                  </div>
                )}

                {/* Plan name & price */}
                <div>
                  <p className="font-data text-xs uppercase tracking-widest text-ee-muted mb-1">
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="font-display text-3xl text-ee-primary">{fmt(price)}</span>
                    <span className="text-ee-muted text-sm mb-1">/mo</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-ee-muted">
                      {fmt(price * 12)}/yr · saves {fmt(plan.monthly * 12 - price * 12)}
                    </p>
                  )}
                  <p className="text-sm text-ee-muted mt-3 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* CTA — different for current vs. other plans */}
                {isCurrent ? (
                  <div className="text-center py-2.5 rounded-lg text-sm font-semibold border border-ee-emerald/40 bg-ee-emerald/10 text-ee-emerald">
                    Your current plan
                  </div>
                ) : currentTier ? (
                  <a
                    href={`mailto:access@equitaselite.com?subject=${encodeURIComponent(`Upgrade to ${plan.name}`)}`}
                    className={`text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      plan.highlight
                        ? 'bg-ee-gold text-ee-bg hover:brightness-110'
                        : 'border border-ee-border text-ee-primary hover:border-ee-gold/40 hover:bg-white/5'
                    }`}
                  >
                    {plan.id === 'access' ? 'Contact us' : `Upgrade to ${plan.name}`}
                  </a>
                ) : (
                  <Link
                    href="/request-access"
                    className={`text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      plan.highlight
                        ? 'bg-ee-gold text-ee-bg hover:brightness-110'
                        : 'border border-ee-border text-ee-primary hover:border-ee-gold/40 hover:bg-white/5'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}

                {/* Feature list */}
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f.label} className="flex items-start gap-2.5">
                      <CheckIcon filled={f.included} />
                      <span className={`text-sm leading-snug ${
                        f.included ? 'text-ee-primary' : 'text-white/30'
                      }`}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-ee-muted">
          All memberships are billed in USD. Pricing shown excludes applicable taxes.
          Membership is subject to vetting and approval.{' '}
          <a href="mailto:access@equitaselite.com" className="text-ee-gold hover:underline">
            Contact us
          </a>{' '}
          for custom enterprise arrangements.
        </p>

      </div>
    </main>
  )
}

import Link from 'next/link'

export const metadata = {
  title: 'Equitas Elite — Where institutional capital meets verified mandate',
  description:
    'A private, invitation-only platform connecting angels, family offices, foundations, DAFs, and next-gen allocators through mandate-matched introductions.',
}

function NavBar() {
  return (
    <header
      className="sticky top-0 z-50 bg-ee-bg/80 backdrop-blur-md border-b border-ee-outline/30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* Decorative when paired with the visible brand text — alt="" tells
              screen readers to skip the logo so it doesn't announce
              "Equitas Elite Equitas Elite" back-to-back. */}
          <img src="/logo.png" alt="" className="h-9 w-auto rounded" />
          <span className="hidden sm:inline font-display text-base text-ee-gold">Equitas Elite</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6">
          <a href="#how-it-works" className="hidden sm:inline font-data text-[11px] tracking-widest uppercase text-ee-muted hover:text-ee-primary transition-colors">
            How it works
          </a>
          <Link href="/pricing" className="font-data text-[11px] tracking-widest uppercase text-ee-muted hover:text-ee-primary transition-colors">
            Pricing
          </Link>
          <Link href="/signin" className="font-data text-[11px] tracking-widest uppercase bg-ee-gold text-ee-bg font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition-all">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glows */}
      <div aria-hidden className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 bg-ee-gold/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden className="absolute -bottom-1/3 -left-1/4 w-2/3 h-2/3 bg-ee-emerald/[0.04] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-5 md:px-8 pt-24 pb-20 md:pt-32 md:pb-28 text-center">
        <p className="font-data text-[11px] tracking-[0.2em] uppercase text-ee-gold mb-6">
          Invitation only
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-ee-primary leading-[1.1] max-w-3xl mx-auto">
          Where allocators find each other{' '}
          <span className="text-ee-gold">on purpose, not by accident</span>.
        </h1>
        <p className="mt-6 text-ee-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          A private, invitation-only platform for angels, family offices, foundations, DAFs, and next-gen allocators &mdash; turning declared mandates into intentional introductions.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/try"
            className="btn-gold inline-flex items-center justify-center gap-2"
          >
            See the platform
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
          <Link
            href="/request-access"
            className="btn-ghost inline-flex items-center justify-center"
          >
            Join the waitlist
          </Link>
          <Link
            href="/signin"
            className="btn-ghost inline-flex items-center justify-center"
          >
            I have an account
          </Link>
        </div>
        {/* Was /80 (4.19:1) — bumped to clear WCAG AA 4.5:1. */}
        <p className="mt-4 text-[12px] text-ee-muted">
          Walk through a private demo as any role — Angel, Family Office, Foundation, DAF, or Next Gen.
          Demo content only; no real-member data.
        </p>
      </div>
    </section>
  )
}

function TrustStrip() {
  const stats = [
    { value: '10', label: 'Sectors covered' },
    { value: '6',  label: 'Investment stages' },
    { value: '6',  label: 'Global regions' },
    { value: '$250K–$100M', label: 'Check-size range' },
  ]
  return (
    <section className="border-y border-ee-outline/30 bg-ee-surface-low/30">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="font-display text-2xl md:text-3xl text-ee-gold">{s.value}</p>
              <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted mt-1.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Define your mandate',
      desc: 'Set sectors, stages, check sizes, geography, and risk tolerance. Two minutes of intake powers everything that follows.',
      icon: 'tune',
    },
    {
      n: '02',
      title: 'See aligned counterparties',
      desc: 'A scoring algorithm ranks every other member of the platform against your mandate. Strong fits surface first.',
      icon: 'insights',
    },
    {
      n: '03',
      title: 'Request introductions',
      desc: 'Send a personalized note. Either side can accept or decline. Accepted introductions exchange contact information.',
      icon: 'handshake',
    },
  ]

  return (
    <section id="how-it-works" className="py-20 md:py-24">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="text-center mb-12">
          <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-muted mb-3">How it works</p>
          <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
            From mandate to introduction in three steps.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map(s => (
            <div key={s.n} className="glass-panel p-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-ee-gold">{s.n}</span>
                <span
                  className="material-symbols-outlined text-ee-gold/60 text-2xl"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
                >
                  {s.icon}
                </span>
              </div>
              <div>
                <h3 className="font-display text-lg text-ee-primary mb-2">{s.title}</h3>
                <p className="text-ee-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ValueProps() {
  const props = [
    {
      icon: 'verified',
      title: 'Vetted by invitation',
      desc: 'Every member is approved before they reach the platform. No mass marketplaces, no fake mandates.',
    },
    {
      icon: 'tune',
      title: 'Six-pillar mandate scoring',
      desc: 'Matches scored across strategic scope, capital mechanics, time and risk, governance, counterparty profile, and values — each weighted by your own mandate. The same counterparty can rank differently for each side.',
    },
    {
      icon: 'lock',
      title: 'Private by default',
      desc: 'Compatibility-matched counterparties only — angels see FOs, foundations, DAFs, and next-gen peers; FOs see the right opposite mix. Sovereign members can opt into Off-Market mode and stay invisible until they reach out. Two-factor on every account.',
    },
    {
      icon: 'support_agent',
      title: 'White-glove options',
      desc: 'Sovereign-tier members get a dedicated relationship manager, bespoke intelligence, and curated deal flow.',
    },
  ]
  return (
    <section className="py-20 md:py-24 bg-ee-surface-low/40 border-y border-ee-outline/30">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="text-center mb-12">
          <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-muted mb-3">Built for principals</p>
          <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
            Why members choose Equitas Elite.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {props.map(p => (
            <div key={p.title} className="glass-panel p-6 flex gap-5">
              <div className="w-11 h-11 rounded-lg bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-ee-gold text-xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
                >
                  {p.icon}
                </span>
              </div>
              <div>
                <h3 className="font-display text-base text-ee-primary mb-1.5">{p.title}</h3>
                <p className="text-ee-muted text-sm leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingTeaser() {
  // Annual prices (monthly base × 0.80) so the teaser matches /pricing's
  // default-annual tab. Source of truth lives in PricingClient.tsx; if
  // tier monthlys move, update both. Annual base monthlys for reference:
  // Access $1,500, Select $3,750, Sovereign $9,500.
  const tiers = [
    { name: 'Access',    price: '$1,200',  blurb: 'Curated deal flow' },
    { name: 'Select',    price: '$3,000',  blurb: 'Active deployment',  featured: true },
    { name: 'Sovereign', price: '$7,600',  blurb: 'White-glove service' },
  ]
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="text-center mb-10">
          <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-muted mb-3">Membership</p>
          <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
            Three tiers of access.
          </h2>
          <p className="text-ee-muted mt-3 text-sm">Billed annually &mdash; save 20% vs monthly.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {tiers.map(t => (
            <div
              key={t.name}
              className={`glass-panel p-6 text-center ${t.featured ? 'border-ee-gold/50' : ''}`}
            >
              <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">{t.name}</p>
              <p className="font-display text-3xl text-ee-primary">
                {t.price}
                <span className="text-ee-muted text-sm font-sans ml-0.5">/mo</span>
              </p>
              <p className="text-ee-muted text-xs mt-2">{t.blurb}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/pricing" className="font-data text-[11px] tracking-widest uppercase text-ee-gold hover:underline">
            See full feature comparison →
          </Link>
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const items = [
    {
      q: 'Who is Equitas Elite for?',
      a: 'Angels, family offices, family foundations, donor-advised funds, and next-gen allocators. Every account is approved before it joins the platform — we manually vet for institutional mandate, track record, and deployment cadence.',
    },
    {
      q: 'How does matching work?',
      a: 'After onboarding you receive a fit score against every compatible counterparty. The algorithm spans six pillars — strategic scope, capital mechanics, time and risk, governance, counterparty profile, and values — each weighted by your own mandate. Strong fits surface first; hard filters (anti-sectors, ESG, tier floors) hide counterparties from your view entirely.',
    },
    {
      q: 'Is my profile information private?',
      a: 'Yes. Your profile is only visible to compatible counterparties (the platform follows an explicit who-matches-whom matrix — angels see FOs, foundations, DAFs, and next-gen peers; FOs see the corresponding opposite mix). Sovereign members can also opt into Off-Market mode, hiding entirely until they choose to reach out. All accounts require two-factor authentication; data lives in private, encrypted infrastructure.',
    },
    {
      q: 'What happens after an introduction is accepted?',
      a: 'Both sides receive each other’s primary email and can take the conversation off-platform. Equitas Elite makes the introduction, not the deal — we never touch your transaction.',
    },
    {
      q: 'How do I join?',
      a: <>Equitas Elite is reviewed manually before access is granted. <Link className="text-ee-gold hover:underline" href="/request-access">Join the waitlist</Link> with a brief note about your firm and mandate; we&apos;ll invite you as we onboard the next cohort.</>,
    },
  ]
  return (
    <section className="py-20 md:py-24 bg-ee-surface-low/40 border-y border-ee-outline/30">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <div className="text-center mb-10">
          <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-muted mb-3">Questions</p>
          <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
            Frequently asked.
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((it, i) => (
            <details
              key={i}
              className="glass-panel p-5 group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-display text-base text-ee-primary">{it.q}</span>
                <span
                  className="material-symbols-outlined text-ee-gold text-xl transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  add
                </span>
              </summary>
              <div className="text-ee-muted text-sm leading-relaxed mt-3 pt-3 border-t border-ee-outline/30">
                {it.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
        <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
          Ready to find your <span className="text-ee-gold">aligned counterparties</span>?
        </h2>
        <p className="text-ee-muted mt-4 text-base">
          Membership is invitation-only and reviewed manually. Join the waitlist now &mdash; we&apos;re onboarding the next cohort shortly.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/request-access"
            className="btn-gold inline-flex items-center justify-center gap-2"
          >
            Join the waitlist
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
          <Link href="/signin" className="btn-ghost inline-flex items-center justify-center">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ee-outline/30 py-10">
      <div className="max-w-5xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          {/* alt="" — decorative; "Equitas Elite" text is the adjacent span. */}
          <img src="/logo.png" alt="" className="h-7 w-auto rounded" />
          <span className="font-display text-sm text-ee-gold">Equitas Elite</span>
        </div>
        <nav className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center">
          <a href="#how-it-works" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">How it works</a>
          <Link href="/pricing" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Pricing</Link>
          <Link href="/signin" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Sign in</Link>
          <Link href="/privacy" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Privacy</Link>
          <Link href="/terms" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Terms</Link>
          <a href="mailto:access@equitaselite.com" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Contact</a>
        </nav>
        {/* Was /70 (3.48:1) — bumped to clear WCAG AA 4.5:1. */}
        <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted">
          © {new Date().getFullYear()} Equitas Elite
        </p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-grow">
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <ValueProps />
        <PricingTeaser />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

import Link from 'next/link'

export const metadata = {
  title: 'Equitas Elite — Where institutional capital meets verified mandate',
  description:
    'A private, invitation-only platform connecting angel investors and family offices through mandate-matched introductions.',
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-ee-bg/80 backdrop-blur-md border-b border-ee-outline/30">
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Equitas Elite" className="h-9 w-auto rounded" />
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
          Where angel investors and family offices find each other{' '}
          <span className="text-ee-gold">on purpose, not by accident</span>.
        </h1>
        <p className="mt-6 text-ee-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          A private, invitation-only platform that turns declared mandates into intentional introductions.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/request-access"
            className="btn-gold inline-flex items-center justify-center gap-2"
          >
            Request access
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
          <Link
            href="/signin"
            className="btn-ghost inline-flex items-center justify-center"
          >
            I have an account
          </Link>
        </div>
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
      title: 'Mandate-first scoring',
      desc: 'Matches are ranked by sector, stage, check size, and geography overlap — not vanity metrics or paid placement.',
    },
    {
      icon: 'lock',
      title: 'Private by default',
      desc: 'Your profile is visible only to opposite-role counterparties whose mandates you also match. Two-factor on every account.',
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
  const tiers = [
    { name: 'Access',    price: '$1,200',  blurb: 'Curated deal flow' },
    { name: 'Select',    price: '$3,000',  blurb: 'Active deployment',  featured: true },
    { name: 'Sovereign', price: '$7,500',  blurb: 'White-glove service' },
  ]
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="text-center mb-10">
          <p className="font-data text-[10px] tracking-[0.2em] uppercase text-ee-muted mb-3">Membership</p>
          <h2 className="font-display text-3xl md:text-4xl text-ee-primary">
            Three tiers of access.
          </h2>
          <p className="text-ee-muted mt-3 text-sm">All prices /month, billed annually.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {tiers.map(t => (
            <div
              key={t.name}
              className={`glass-panel p-6 text-center ${t.featured ? 'border-ee-gold/50' : ''}`}
            >
              <p className="font-data text-[10px] uppercase tracking-widest text-ee-muted mb-2">{t.name}</p>
              <p className="font-display text-3xl text-ee-primary">{t.price}</p>
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
      a: 'Active angel investors and family offices. Every account is approved before it joins the platform — we manually vet for institutional mandate, track record, and deployment cadence.',
    },
    {
      q: 'How does matching work?',
      a: 'After onboarding you receive a fit score against every counterparty on the platform. The algorithm weights sector overlap (40%), stage overlap (30%), check-size compatibility (20%), and geographic alignment (10%). Strong fits surface first.',
    },
    {
      q: 'Is my profile information private?',
      a: 'Yes. Your profile is only visible to opposite-role counterparties (angels see family offices and vice-versa). All accounts require two-factor authentication. Data lives in private, encrypted infrastructure.',
    },
    {
      q: 'What happens after an introduction is accepted?',
      a: 'Both sides receive each other’s primary email and can take the conversation off-platform. Equitas Elite makes the introduction, not the deal — we never touch your transaction.',
    },
    {
      q: 'How do I request access?',
      a: <>Submit the <Link className="text-ee-gold hover:underline" href="/request-access">access request form</Link> with a brief note about your firm and mandate. We typically respond within two business days.</>,
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
          Membership is invitation-only and reviewed manually. Reach out and we&apos;ll be in touch.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/request-access"
            className="btn-gold inline-flex items-center justify-center gap-2"
          >
            Request access
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
          <img src="/logo.png" alt="Equitas Elite" className="h-7 w-auto rounded" />
          <span className="font-display text-sm text-ee-gold">Equitas Elite</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#how-it-works" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">How it works</a>
          <Link href="/pricing" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Pricing</Link>
          <Link href="/signin" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Sign in</Link>
          <a href="mailto:access@equitaselite.com" className="font-data text-[10px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">Contact</a>
        </nav>
        <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted/70">
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

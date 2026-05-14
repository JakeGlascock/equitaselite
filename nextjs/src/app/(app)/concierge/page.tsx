import ConciergeForm from './ConciergeForm'

const SERVICES = [
  {
    title: 'Bespoke introductions',
    desc:  'When you need to reach a specific firm or principal outside the platform, we make warm introductions through our network.',
    icon:  'handshake',
  },
  {
    title: 'Due diligence support',
    desc:  'Background checks, mandate verification, reference calls — we coordinate the workstreams while you focus on the deal.',
    icon:  'fact_check',
  },
  {
    title: 'Counterparty vetting',
    desc:  'Independent vetting of investors or founders not yet on the platform. Comes with a written summary and risk flags.',
    icon:  'verified_user',
  },
  {
    title: 'Market intelligence',
    desc:  'Targeted research on sectors, sub-sectors, or specific opportunities. Delivered as a memo within five business days.',
    icon:  'query_stats',
  },
]

export default function ConciergePage() {
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">White-glove</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Concierge</h1>
          <p className="text-ee-muted text-sm mt-1">
            A direct line to our team for what falls outside the platform&apos;s automated flow.
          </p>
        </div>

        {/* Relationship manager card */}
        <div className="glass-panel p-6 flex items-center gap-5 border-ee-gold/30">
          <div className="w-14 h-14 rounded-full bg-ee-gold/20 border border-ee-gold/40 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-ee-gold text-2xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
            >
              support_agent
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold mb-1">Your relationship manager</p>
            <p className="font-display text-lg text-ee-primary">Olivia Marchetti</p>
            <p className="text-xs text-ee-muted">Available 9am–6pm ET · responds within 4 business hours</p>
          </div>
          <a
            href="mailto:olivia@equitaselite.com"
            className="hidden sm:inline btn-ghost whitespace-nowrap"
          >
            Email Olivia
          </a>
        </div>

        {/* Service categories */}
        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">What we handle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map(s => (
              <div key={s.title} className="glass-panel p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-ee-gold text-lg">{s.icon}</span>
                </div>
                <div>
                  <h3 className="font-display text-base text-ee-primary mb-1.5">{s.title}</h3>
                  <p className="text-xs text-ee-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Request form */}
        <section>
          <h2 className="font-display text-xl text-ee-primary mb-4">Submit a request</h2>
          <ConciergeForm />
        </section>
      </div>
    </div>
  )
}

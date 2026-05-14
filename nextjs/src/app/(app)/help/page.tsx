import HelpClient from './HelpClient'

const CONTACT_OPTIONS = [
  {
    icon: 'support_agent',
    title: 'Concierge',
    desc:  'For account-specific or sensitive requests.',
    cta:   'Open Concierge',
    href:  '/concierge',
  },
  {
    icon: 'mail',
    title: 'Email support',
    desc:  'For everything else. We respond within 1 business day.',
    cta:   'access@equitaselite.com',
    href:  'mailto:access@equitaselite.com',
  },
]

export default function HelpPage() {
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Support</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Help Center</h1>
          <p className="text-ee-muted text-sm mt-1">
            Answers to common questions, platform documentation, and direct contact with our member-success team.
          </p>
        </div>

        <HelpClient />

        {/* Contact options */}
        <section className="pt-6 border-t border-ee-outline/30">
          <h2 className="font-display text-xl text-ee-primary mb-4">Still need a hand?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONTACT_OPTIONS.map(o => (
              <a
                key={o.title}
                href={o.href}
                className="glass-panel p-5 flex gap-4 hover:border-ee-gold/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-ee-gold text-lg">{o.icon}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base text-ee-primary mb-1">{o.title}</h3>
                  <p className="text-xs text-ee-muted mb-2">{o.desc}</p>
                  <span className="text-xs text-ee-gold font-data uppercase tracking-wider">
                    {o.cta} →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

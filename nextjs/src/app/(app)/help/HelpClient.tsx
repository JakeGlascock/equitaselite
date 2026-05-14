'use client'

import { useMemo, useState } from 'react'

interface FAQ {
  q:        string
  a:        string
  category: 'Getting started' | 'Matching' | 'Introductions' | 'Account' | 'Membership'
}

const FAQS: FAQ[] = [
  {
    category: 'Getting started',
    q: 'How do I complete my onboarding?',
    a: 'After signing in for the first time, you\'ll be guided through a four-step intake — role, focus areas, check sizes, and role-specific preferences. It takes about two minutes. You can edit any of it later from Settings.',
  },
  {
    category: 'Getting started',
    q: 'Can I change my role after onboarding?',
    a: 'Yes — go to Settings, scroll to the role field, and update it. Your match list will refresh against the new role on your next dashboard load.',
  },
  {
    category: 'Matching',
    q: 'How is my fit score calculated?',
    a: 'The score weights sector overlap (40%), stage overlap (30%), check-size compatibility (20%), and geographic alignment (10%). Each axis is normalized to 0–100; the total is the weighted sum, capped at 99. Labels: Strong Fit (80+), Good Fit (65–79), Possible Fit (50–64), Low Fit (under 50).',
  },
  {
    category: 'Matching',
    q: 'Why don\'t I see angel investors (or family offices) I know?',
    a: 'You only see opposite-role counterparties. Angels see family offices; family offices see angels. Same-role browsing is on the roadmap.',
  },
  {
    category: 'Matching',
    q: 'How often is the match list updated?',
    a: 'Real-time. Edit your mandate and refresh the Dashboard — scores are recalculated on every page load.',
  },
  {
    category: 'Introductions',
    q: 'What happens when I request an introduction?',
    a: 'The other party receives an in-app notification and an email (if they\'ve opted in). They can accept or decline. On accept, both sides see each other\'s primary email and can take the conversation off-platform.',
  },
  {
    category: 'Introductions',
    q: 'Can I include a message with my request?',
    a: 'Yes — clicking "Request introduction" expands a textarea. You have 500 characters to introduce yourself, mention specific overlap, or propose a context. Optional but recommended.',
  },
  {
    category: 'Introductions',
    q: 'Can I cancel a pending request?',
    a: 'Not yet — once sent, a request stays pending until the recipient responds. We\'re working on a cancel/retract flow.',
  },
  {
    category: 'Account',
    q: 'How do I turn off email notifications?',
    a: 'Go to Settings, scroll to the bottom of step four, and uncheck "Email notifications". In-app notifications (the bell) stay active.',
  },
  {
    category: 'Account',
    q: 'How do I enable two-factor authentication?',
    a: 'Two-factor is required at signup — you set up a TOTP authenticator (1Password, Authy, Google Authenticator) on first login. To reset, contact your relationship manager.',
  },
  {
    category: 'Account',
    q: 'How do I update my email address?',
    a: 'Email address changes require manual verification of the new address. Reach out via Concierge or directly to access@equitaselite.com.',
  },
  {
    category: 'Membership',
    q: 'Which membership tier am I on?',
    a: 'Visit the Pricing page to see the three tiers. Your tier is currently administered manually; reach out to your relationship manager to upgrade or downgrade.',
  },
  {
    category: 'Membership',
    q: 'Can I share my account with a colleague?',
    a: 'Memberships are issued per individual. For multi-seat firm access (typical for family offices), contact us about a Sovereign team plan.',
  },
  {
    category: 'Membership',
    q: 'How do I cancel my membership?',
    a: 'Email access@equitaselite.com and we\'ll process the cancellation within one business day. We pro-rate refunds for any unused months on annual plans.',
  },
]

const CATEGORIES = ['All', 'Getting started', 'Matching', 'Introductions', 'Account', 'Membership']

export default function HelpClient() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = useMemo(() => {
    let out = FAQS
    if (filter !== 'All') out = out.filter(f => f.category === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
    }
    return out
  }, [filter, search])

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ee-muted text-lg pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search the help center…"
          className="input-field pl-10"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filter === c
                ? 'bg-ee-gold text-ee-bg border-ee-gold'
                : 'border-ee-border text-ee-primary hover:border-ee-gold/50 hover:text-ee-gold'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* FAQ list */}
      <p className="text-xs text-ee-muted">
        {filtered.length} {filtered.length === 1 ? 'answer' : 'answers'}
      </p>

      {filtered.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-ee-muted text-sm">No answers matched your search.</p>
          <p className="text-xs text-ee-muted mt-2">
            Try different keywords or{' '}
            <a className="text-ee-gold hover:underline" href="/concierge">ask the concierge</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f, i) => (
            <details
              key={i}
              className="glass-panel p-5 group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-start justify-between cursor-pointer list-none gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-data text-[10px] uppercase tracking-widest text-ee-gold mb-1">
                    {f.category}
                  </p>
                  <p className="font-display text-base text-ee-primary leading-snug">{f.q}</p>
                </div>
                <span
                  className="material-symbols-outlined text-ee-gold text-xl transition-transform group-open:rotate-45 shrink-0 mt-1"
                  aria-hidden
                >
                  add
                </span>
              </summary>
              <div className="text-ee-muted text-sm leading-relaxed mt-3 pt-3 border-t border-ee-outline/30">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

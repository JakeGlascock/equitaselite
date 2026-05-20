import Link from 'next/link'

export const metadata = {
  title:       'Terms — Equitas Elite',
  description: 'Terms of Service for Equitas Elite.',
}

const LAST_UPDATED = '2026-05-20'
const ENTITY       = process.env.PRIVACY_CONTROLLER ?? 'Equitas Elite · 1209 N Orange St, Wilmington, DE 19801, USA'
const CONTACT      = process.env.PRIVACY_CONTACT    ?? 'privacy@equitaselite.com'

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-8">

        <header className="space-y-2">
          <Link href="/" className="inline-block text-xs text-ee-muted hover:text-ee-primary transition-colors mb-2">
            ← Back to Equitas Elite
          </Link>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Agreement</p>
          <h1 className="font-display text-4xl text-ee-gold">Terms of Service</h1>
          <p className="text-ee-muted text-sm">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="glass-panel p-6 md:p-8 space-y-4 text-ee-primary leading-relaxed">
          <p>
            These Terms govern your use of Equitas Elite (the &ldquo;Service&rdquo;), an
            invitation-only platform that introduces institutional investors and allocators
            to one another based on declared mandates. By creating an account, joining the
            waitlist, requesting a demo, or otherwise using the Service, you agree to these
            Terms.
          </p>
          <div className="mt-3 px-4 py-3 rounded-md border border-ee-gold/30 bg-ee-gold/[0.06]">
            <p className="text-[11px] font-data uppercase tracking-wider text-ee-gold">Boilerplate notice</p>
            <p className="text-xs text-ee-muted mt-1 leading-relaxed">
              This Terms of Service is a working draft maintained by the Equitas Elite team. It is
              not yet counsel-reviewed and will be replaced with a lawyer-prepared version before
              the first paying customer. Substantive obligations described here reflect operational
              reality today; the language will be tightened.
            </p>
          </div>
        </section>

        <Section title="1. Eligibility">
          <p>
            Membership is by invitation and reviewed manually. Prospects join the waitlist
            via <Link href="/request-access" className="text-ee-gold hover:underline">/request-access</Link> and
            are admitted in cohorts. By joining, you represent that you have authority to
            do so on behalf of the firm, family office, foundation, donor-advised fund, or
            individual allocator you list. The Service is intended for institutional and
            accredited investors; you are responsible for confirming that your participation
            is consistent with applicable laws and your own compliance requirements.
          </p>
        </Section>

        <Section title="2. What the Service does — and doesn't">
          <p>
            Equitas Elite is a <strong className="text-ee-primary">routing layer</strong>: we match members
            against each other&apos;s declared mandates, surface compatible counterparties, and
            facilitate introductions. We do not provide investment advice, fundraising advice,
            brokerage services, or any form of solicitation on your behalf. We do not
            participate in, custody, or transact in any deals between members.
          </p>
          <p>
            Members exchange contact information only when both sides accept an introduction;
            any subsequent communication, diligence, transaction, or relationship is entirely
            between the members and outside the Service.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <List items={[
            'Submit false or misleading mandate, identity, or firm information.',
            'Use the Service to send spam, harassment, or unsolicited marketing.',
            'Scrape, mirror, frame, or otherwise extract member data outside the in-product UI.',
            'Attempt to bypass authentication, rate limiting, the Off-Market visibility model, or any other technical control.',
            'Use the Service to solicit retail (non-accredited) investors, market unregistered securities to ineligible audiences, or violate applicable securities, AML, or sanctions laws.',
            'Resell, sublicense, or share your account access with anyone outside your firm.',
          ]} />
          <p>
            We may suspend or terminate accounts that violate these rules, with or without
            notice depending on severity.
          </p>
        </Section>

        <Section title="4. Mandate accuracy + your representations">
          <p>
            The Service relies on your declared mandate being honest and current. By using
            the Service you represent that your mandate fields (check size, sectors, stages,
            geography, time horizon, etc.) accurately describe your actual investing
            behaviour, and you agree to update them when they materially change. Mandate
            misrepresentation undermines the matching value for every other member and is
            grounds for removal.
          </p>
        </Section>

        <Section title="5. Introductions are not investment advice">
          <p>
            A high match score, an admin recommendation, a concierge endorsement, or any
            other ranking the Service surfaces is <strong className="text-ee-primary">not investment
            advice, due diligence, or an endorsement of any kind</strong>. You are solely
            responsible for evaluating any counterparty, opportunity, or transaction reached
            through the Service. Past results — yours or anyone else&apos;s — are not indicative
            of future results.
          </p>
        </Section>

        <Section title="6. Intellectual property">
          <p>
            Equitas Elite, the matching algorithm, the user interface, the brand, and the
            Service as a whole are our intellectual property. You receive a non-exclusive,
            non-transferable, revocable licence to use the Service in accordance with these
            Terms. You retain all rights to your own mandate data, profile content, and any
            material you submit; you grant us a limited licence to display that material
            within the Service to compatible counterparties as part of normal matching.
          </p>
        </Section>

        <Section title="7. Membership, pricing, and billing">
          <p>
            Membership tiers (Access, Select, Sovereign) and pricing are described on the{' '}
            <Link href="/pricing" className="text-ee-gold hover:underline">pricing page</Link>. Tier
            features, match limits, intro caps, and the Off-Market privacy option are
            enforced server-side; downgrades from Sovereign while in Off-Market mode trigger
            a 7-day grace window before the profile becomes visible again. We may adjust
            pricing or tier features prospectively on reasonable notice.
          </p>
          <p className="text-ee-muted text-sm">
            Payment processing is not yet enabled on the Service; the first cohort joins by
            invitation without payment. When billing launches, additional terms specific to
            payment, refunds, and renewals will apply and will be linked from the pricing
            page.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            You can request account deletion at any time by emailing{' '}
            <a href={`mailto:${CONTACT}`} className="text-ee-gold hover:underline">{CONTACT}</a>.
            We may suspend or terminate your account for violation of these Terms, suspicion
            of fraud, regulatory or legal reasons, or extended inactivity. On termination
            your access to the Service ends; provisions that by their nature should survive
            (IP, disclaimers, limitation of liability, governing law) survive.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The Service is provided <strong className="text-ee-primary">&ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;</strong> without warranty of any kind, express or implied. We
            don&apos;t warrant that the Service will be uninterrupted, error-free, secure
            against every attack, or that any specific match will lead to a successful
            transaction. We don&apos;t guarantee any specific outcomes from membership.
          </p>
          <p>
            Equitas Elite is <strong className="text-ee-primary">not a broker-dealer, investment
            adviser, or fiduciary</strong>. We do not offer or sell securities and do not
            participate in any transaction between members.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the maximum extent permitted by law, in no event will Equitas Elite be liable
            for any indirect, incidental, special, consequential, or punitive damages, or
            for any loss of profits, revenues, data, or business opportunities, arising out
            of or relating to your use of the Service. Our total liability for any claim
            arising out of or relating to these Terms or the Service is limited to the
            greater of: (a) the fees you paid us in the twelve months preceding the claim,
            or (b) USD $100.
          </p>
        </Section>

        <Section title="11. Indemnification">
          <p>
            You agree to indemnify and hold Equitas Elite harmless from any claim, loss, or
            expense (including reasonable attorneys&apos; fees) arising out of (a) your use of
            the Service, (b) any breach of these Terms by you, (c) any misrepresentation in
            your mandate or identity data, or (d) any transaction or relationship between
            you and another member.
          </p>
        </Section>

        <Section title="12. Governing law + disputes">
          <p>
            These Terms are governed by the laws of the State of Delaware, without regard
            to its conflict-of-laws provisions. Any dispute will be brought in the state or
            federal courts located in Delaware, and you consent to the jurisdiction of those
            courts. If a court finds any provision unenforceable, the rest of these Terms
            remain in effect.
          </p>
        </Section>

        <Section title="13. Changes">
          <p>
            We&apos;ll post material changes here with an updated &ldquo;last updated&rdquo; date.
            For significant changes, we&apos;ll also email existing members in advance.
            Continued use of the Service after changes take effect constitutes acceptance.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Operating entity: <strong className="text-ee-primary">{ENTITY}</strong>
          </p>
          <p>
            Questions about these Terms:{' '}
            <a href={`mailto:${CONTACT}`} className="text-ee-gold hover:underline">{CONTACT}</a>
          </p>
        </Section>

      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel p-6 md:p-8 space-y-3 text-ee-primary leading-relaxed">
      <h2 className="font-display text-xl text-ee-gold">{title}</h2>
      {children}
    </section>
  )
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc list-outside ml-5 space-y-2 text-sm text-ee-muted leading-relaxed">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

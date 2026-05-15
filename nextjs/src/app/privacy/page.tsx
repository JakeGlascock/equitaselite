import Link from 'next/link'

export const metadata = {
  title:       'Privacy — Equitas Elite',
  description: 'How Equitas Elite collects, uses, and protects your data.',
}

const LAST_UPDATED = '2026-05-15'
const CONTROLLER   = process.env.PRIVACY_CONTROLLER ?? 'Equitas Elite · 1209 N Orange St, Wilmington, DE 19801, USA'
const CONTACT      = process.env.PRIVACY_CONTACT    ?? 'privacy@equitaselite.com'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-8">

        <header className="space-y-2">
          <Link href="/" className="inline-block text-xs text-ee-muted hover:text-ee-primary transition-colors mb-2">
            ← Back to Equitas Elite
          </Link>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Policy</p>
          <h1 className="font-display text-4xl text-ee-gold">Privacy</h1>
          <p className="text-ee-muted text-sm">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="glass-panel p-6 md:p-8 space-y-4 text-ee-primary leading-relaxed">
          <p>
            Equitas Elite is an invitation-only platform for institutional
            investors. This page describes what data we collect from members
            and visitors, how we use it, and the controls you have over it.
          </p>
          <p className="text-ee-muted text-sm">
            We aim for plain English. If anything below is unclear, write to{' '}
            <a href={`mailto:${CONTACT}`} className="text-ee-gold hover:underline">{CONTACT}</a>.
          </p>
        </section>

        <Section title="What we collect">
          <p>From you directly:</p>
          <List items={[
            'Account: email, full name, firm name, title, and (for family offices) AUM range.',
            'Mandate: sectors, stages, geography, check-size range, risk tolerance, role-specific return / horizon / mandate type / deal structure.',
            'Activity: introduction requests you send or receive, RSVPs to events, in-app notifications you mark read.',
            'Optional notes you submit through /request-access before you have an account.',
          ]} />
          <p>Captured automatically:</p>
          <List items={[
            'Authentication state managed by AWS Cognito (a cookie-based session and a refresh token).',
            'Standard server logs (request path, response status, IP, user-agent) retained for security and operational debugging.',
            'CloudTrail audit logs of administrative actions in our AWS account.',
          ]} />
          <p>
            We do <strong>not</strong> use third-party advertising trackers, share
            your data with brokers, or sell information to anyone.
          </p>
        </Section>

        <Section title="How we use it">
          <List items={[
            'Match you to counterparties on the opposite side of the market using the algorithm in /lib/scoring.ts (sector, stage, check size, geography).',
            'Send transactional emails (introduction requests, accept / decline notices, weekly digest of new counterparties) — every one of which carries a one-click unsubscribe.',
            'Operate the platform: serve the site, prevent abuse, debug issues, comply with legal obligations.',
          ]} />
        </Section>

        <Section title="Your controls">
          <List items={[
            <span key="prof">Edit or remove most account fields anytime from your <Link href="/profile" className="text-ee-gold hover:underline">profile</Link>.</span>,
            <span key="email">Turn email notifications off with one click from your profile, or via the unsubscribe link in any email.</span>,
            <span key="del">Request full account deletion by emailing <a href={`mailto:${CONTACT}`} className="text-ee-gold hover:underline">{CONTACT}</a>. We honour deletion within 30 days, minus any data we are legally required to retain.</span>,
            <span key="dl">Request a copy of your account data by email. We export the relevant rows as JSON.</span>,
          ]} />
        </Section>

        <Section title="Where it lives">
          <List items={[
            'PostgreSQL on AWS RDS (us-east-1), encrypted at rest with a customer-managed KMS key. Multi-AZ. 35-day point-in-time recovery.',
            'AWS Cognito user pool (us-east-1) for authentication.',
            'AWS S3 for any documents you upload, encrypted at rest with a customer-managed KMS key, accessed only via short-lived signed URLs.',
            'AWS SES (us-east-1) sends outbound mail from system@equitaselite.com. DKIM-signed, SPF aligned, DMARC p=reject.',
          ]} />
          <p>
            All inbound and outbound traffic uses TLS. The database is in a
            private subnet with no public internet exposure.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            When two members accept an introduction, both parties&apos; primary
            email addresses are revealed to each other so the conversation can
            continue off-platform. That is the only sharing of personal data
            between members; it requires explicit acceptance from the recipient.
          </p>
          <p>
            We use AWS as our infrastructure provider and Cognito as our
            identity provider; both process data on our behalf as sub-processors
            under their standard terms. No data is shared with marketing
            partners, ad networks, or data brokers.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            Account data is retained for the life of your membership and for
            30 days after deletion is confirmed. Server logs are retained for
            30 days. Backups, snapshots, and CloudTrail archives are retained
            for up to 90 days for operational and audit purposes.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Equitas Elite is for institutional investors. The platform is not
            intended for, and we do not knowingly collect data from, anyone
            under 18.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We&apos;ll post material changes here with an updated &ldquo;last
            updated&rdquo; date. For significant changes, we&apos;ll also email
            existing members in advance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Data controller: <strong className="text-ee-primary">{CONTROLLER}</strong>
          </p>
          <p>
            Privacy inquiries:{' '}
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

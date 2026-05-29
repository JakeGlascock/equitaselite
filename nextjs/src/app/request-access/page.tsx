import Link from 'next/link'
import Image from 'next/image'
import RequestForm from './RequestForm'

export const metadata = {
  title: 'Join the waitlist — Equitas Elite',
  description: 'Reserve your spot in the next Equitas Elite cohort. Invitation-only, reviewed manually, limited seats.',
}

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Lightweight nav (no app shell — this page is pre-auth) */}
      <header className="border-b border-ee-outline/30">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-mark.png" alt="" width={36} height={36} priority className="h-9 w-9" />
            <span className="hidden sm:inline font-display text-base text-ee-gold">Equitas Elite</span>
          </Link>
          <Link href="/signin" className="font-data text-[11px] tracking-widest uppercase text-ee-muted hover:text-ee-primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-grow py-12 md:py-20 px-5 md:px-8">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="text-center">
            <p className="font-data text-[11px] tracking-[0.2em] uppercase text-ee-gold mb-3">
              Invitation only · Limited seats
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ee-primary leading-tight">
              Join the waitlist
            </h1>
            <p className="text-ee-muted text-sm mt-3 leading-relaxed">
              We&apos;re reviewing applications manually and inviting members in cohorts. Share a bit
              about your firm and mandate &mdash; you&apos;ll hear from us when the next cohort opens.
            </p>
          </div>

          <RequestForm />
        </div>
      </main>

      <footer className="border-t border-ee-outline/30 py-6">
        <div className="max-w-6xl mx-auto px-5 md:px-8 text-center">
          <p className="font-data text-[10px] tracking-widest uppercase text-ee-muted/70">
            © {new Date().getFullYear()} Equitas Elite
          </p>
        </div>
      </footer>
    </div>
  )
}

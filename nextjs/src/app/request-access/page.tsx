import Link from 'next/link'
import RequestForm from './RequestForm'

export const metadata = {
  title: 'Request access — Equitas Elite',
  description: 'Apply for an invitation to Equitas Elite, the private platform for institutional investor alignment.',
}

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Lightweight nav (no app shell — this page is pre-auth) */}
      <header className="border-b border-ee-outline/30">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Equitas Elite" className="h-9 w-auto rounded" />
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
              Invitation only
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ee-primary leading-tight">
              Request your invitation
            </h1>
            <p className="text-ee-muted text-sm mt-3 leading-relaxed">
              Equitas Elite is reviewed manually before access is granted. Tell us a bit about
              your firm and we&apos;ll be in touch within two business days.
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

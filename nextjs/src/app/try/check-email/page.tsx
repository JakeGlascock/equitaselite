import Link from 'next/link'

export const metadata = {
  title:       'Check your email — Equitas Elite',
  description: 'A walkthrough link has been sent. Click it to start your demo.',
}

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams
  const safeTo = typeof to === 'string' ? to.trim().slice(0, 254) : ''

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <p className="font-data text-[10px] tracking-[0.15em] uppercase text-ee-muted">Equitas Elite</p>
        <h1 className="font-display text-3xl text-ee-gold mt-3">Check your email</h1>
        <p className="text-ee-muted text-sm mt-3 leading-relaxed">
          We just sent a walkthrough link {safeTo ? <>to <strong className="text-ee-primary">{safeTo}</strong></> : 'to the address you provided'}.
          The link is good for the next 30 minutes. Click it to start your demo.
        </p>
        <div className="mt-8 glass-panel p-4 text-left">
          <p className="text-[11px] text-ee-muted leading-relaxed">
            <strong className="text-ee-primary">Didn&rsquo;t arrive?</strong> Check spam, then{' '}
            <Link href="/try" className="text-ee-gold hover:underline">try again</Link>{' '}
            with the same address. Already a member?{' '}
            <Link href="/signin" className="text-ee-gold hover:underline">Sign in</Link>{' '}
            instead.
          </p>
        </div>
      </div>
    </main>
  )
}

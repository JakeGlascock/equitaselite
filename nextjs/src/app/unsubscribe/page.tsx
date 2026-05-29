import Link from 'next/link'
import Image from 'next/image'
import { queryOne } from '@/lib/db'
import UnsubscribeClient from './UnsubscribeClient'

export const metadata = {
  title:       'Unsubscribe — Equitas Elite',
  description: 'Stop receiving email notifications from Equitas Elite.',
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Profile {
  email:                       string
  full_name:                   string
  email_notifications_enabled: boolean | null
}

export default async function UnsubscribePage(
  { searchParams }: { searchParams: Promise<{ t?: string }> }
) {
  const { t } = await searchParams

  if (!t || !UUID_RX.test(t)) {
    return <Shell><Bad>Unsubscribe link missing or malformed.</Bad></Shell>
  }

  const profile = await queryOne<Profile>(
    `SELECT email, full_name, email_notifications_enabled
     FROM profiles WHERE unsubscribe_token = $1`,
    [t]
  )

  if (!profile) {
    return <Shell><Bad>This unsubscribe link is no longer valid.</Bad></Shell>
  }

  return (
    <Shell>
      <UnsubscribeClient
        token={t}
        email={profile.email}
        fullName={profile.full_name}
        alreadyOff={profile.email_notifications_enabled === false}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo-transparent.png" alt="Equitas Elite" width={80} height={80} priority className="h-20 w-20" />
        </div>
        <div className="glass-panel p-8 space-y-5 text-center">
          {children}
          <p className="text-xs text-ee-muted pt-2 border-t border-ee-border/40">
            <Link href="/" className="hover:text-ee-primary transition-colors">
              Return to Equitas Elite
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function Bad({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="font-display text-2xl text-ee-gold">Can&apos;t process that link</h1>
      <p className="text-sm text-ee-muted">{children}</p>
      <p className="text-xs text-ee-muted">
        Already a member? Sign in and toggle email notifications from
        your profile.
      </p>
    </>
  )
}

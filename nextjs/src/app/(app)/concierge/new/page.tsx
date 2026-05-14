import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import NewManagedForm from './NewManagedForm'

export default async function NewManagedAccountPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  let isConcierge = false
  try {
    const row = await queryOne<{ is_concierge: boolean }>(
      'SELECT is_concierge FROM profiles WHERE id = $1',
      [userId]
    )
    isConcierge = !!row?.is_concierge
  } catch {}

  if (!isConcierge) redirect('/concierge')

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">White-glove</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">New managed account</h1>
          <p className="text-ee-muted text-sm mt-1">
            Create a profile on behalf of your client. They become active on the platform and surface
            in counterparty searches immediately.
          </p>
        </div>

        <NewManagedForm />
      </div>
    </div>
  )
}

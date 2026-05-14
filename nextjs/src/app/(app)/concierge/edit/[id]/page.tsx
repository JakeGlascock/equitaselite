import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { queryOne } from '@/lib/db'
import ManagedAccountForm, { type ManagedAccountFormInitial } from '../../ManagedAccountForm'

interface ManagedProfile {
  id: string
  email: string
  role: 'angel' | 'family_office'
  full_name: string
  title: string | null
  firm_name: string
  location: string | null
  aum: string | null
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  risk_tolerance: string | null
}

export default async function EditManagedAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/signin')

  // Verify the caller is a concierge AND manages this profile in one query
  let profile: ManagedProfile | null = null
  try {
    profile = await queryOne<ManagedProfile>(
      `SELECT p.id, p.email, p.role, p.full_name, p.title, p.firm_name, p.location, p.aum,
              p.sectors, p.stages, p.geography, p.check_size_min, p.check_size_max,
              p.risk_tolerance
       FROM profiles p
       JOIN profiles c ON c.id = p.managed_by AND c.is_concierge = TRUE
       WHERE p.id = $1 AND p.managed_by = $2`,
      [id, userId]
    )
  } catch {
    profile = null
  }

  if (!profile) notFound()

  const initial: ManagedAccountFormInitial = {
    role:           profile.role,
    email:          profile.email,
    full_name:      profile.full_name,
    title:          profile.title ?? '',
    firm_name:      profile.firm_name,
    location:       profile.location ?? '',
    aum:            profile.aum ?? '',
    sectors:        profile.sectors,
    stages:         profile.stages,
    geography:      profile.geography,
    check_size_min: Number(profile.check_size_min),
    check_size_max: Number(profile.check_size_max),
    risk_tolerance: profile.risk_tolerance ?? '',
  }

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">White-glove</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Edit {profile.full_name}</h1>
          <p className="text-ee-muted text-sm mt-1">
            Update mandate or contact details. Changes take effect immediately and refresh match scores.
          </p>
        </div>

        <ManagedAccountForm mode="edit" accountId={id} initial={initial} />
      </div>
    </div>
  )
}

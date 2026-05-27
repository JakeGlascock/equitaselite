import { redirect } from 'next/navigation'
import {
  getMe, getCandidates, getIntroductions,
  buildIntroMap, toMatchView,
} from '@/lib/matches'
import { getActingAsState } from '@/lib/acting-as'
import DiscoveryList from './DiscoveryList'

export default async function DiscoveryPage() {
  const state = await getActingAsState()
  if (!state) redirect('/signin')
  const userId = state.effectiveUserId

  const me = await getMe(userId)
  if (!me || !me.onboarding_completed) redirect('/onboarding')

  const [candidates, intros] = await Promise.all([
    getCandidates(me),
    getIntroductions(userId),
  ])

  const introMap = buildIntroMap(intros, userId)
  const matches  = candidates.map(c => toMatchView(c, me, introMap.get(c.id)))

  const roleLabel = me.role === 'angel' ? 'family offices' : 'angel investors'

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Pipeline</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Discovery</h1>
          <p className="text-ee-muted text-sm mt-1">
            Browse and filter all {matches.length} eligible {roleLabel} on the platform.
          </p>
        </div>

        <DiscoveryList
          matches={matches}
          viewerIsOffMarket={!!me.is_off_market}
          viewer={{
            sectors:      me.sectors,
            stages:       me.stages,
            geography:    me.geography,
            assetClasses: me.asset_classes ?? [],
          }}
          viewerWeights={me.mandate_weights}
        />
      </div>
    </div>
  )
}

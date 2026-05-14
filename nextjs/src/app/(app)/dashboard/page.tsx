import { redirect } from 'next/navigation'
import MatchCard from '@/components/MatchCard'
import {
  getMe, getCandidates, getIntroductions,
  buildIntroMap, toMatchView,
} from '@/lib/matches'
import { getActingAsState } from '@/lib/acting-as'

export default async function DashboardPage() {
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
  const matches  = candidates
    .map(c => toMatchView(c, me, introMap.get(c.id)))
    .sort((a, b) => b.score.total - a.score.total)

  const pendingIncoming = intros.filter(i => i.recipient_id === userId && i.status === 'pending').length
  const firstName = me.full_name.split(' ')[0]
  const roleLabel = me.role === 'angel' ? 'Family Offices' : 'Angel Investors'

  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Executive Overview</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Welcome back, {firstName}</h1>
          <p className="text-ee-muted text-sm mt-1">
            {matches.length > 0
              ? `${matches.length} ${roleLabel} matched to your mandate · ${pendingIncoming} pending request${pendingIncoming === 1 ? '' : 's'}`
              : `No ${roleLabel} have completed their profiles yet`}
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <p className="text-ee-muted text-sm">
              Check back soon — we&apos;re onboarding {roleLabel.toLowerCase()} now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        )}
      </div>
    </div>
  )
}

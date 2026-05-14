import InsightsClient from './InsightsClient'

export default function InsightsPage() {
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Intelligence</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Insights</h1>
          <p className="text-ee-muted text-sm mt-1">
            Sector reports, mandate benchmarks, and market commentary — curated for institutional investors.
          </p>
        </div>

        <InsightsClient />
      </div>
    </div>
  )
}

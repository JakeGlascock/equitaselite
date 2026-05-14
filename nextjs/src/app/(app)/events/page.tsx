import EventsClient from './EventsClient'

export default function EventsPage() {
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">Member-only</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">Events</h1>
          <p className="text-ee-muted text-sm mt-1">
            Invitation-only summits, virtual roundtables with portfolio principals, and exclusive deal-flow showcases.
          </p>
        </div>

        <EventsClient />
      </div>
    </div>
  )
}

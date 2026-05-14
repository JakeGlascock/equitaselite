interface Props {
  eyebrow:     string
  title:       string
  description: string
  icon:        string
}

export default function ComingSoon({ eyebrow, title, description, icon }: Props) {
  return (
    <div className="px-5 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="font-data text-[10px] tracking-[0.12em] text-ee-muted uppercase">{eyebrow}</p>
          <h1 className="font-display text-3xl text-ee-gold mt-1">{title}</h1>
          <p className="text-ee-muted text-sm mt-1">{description}</p>
        </div>

        <div className="glass-panel p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-ee-gold/15 border border-ee-gold/30 flex items-center justify-center mx-auto mb-4">
            <span
              className="material-symbols-outlined text-ee-gold text-3xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
            >
              {icon}
            </span>
          </div>
          <p className="font-display text-xl text-ee-primary">Coming soon</p>
          <p className="text-ee-muted text-sm mt-2 max-w-md mx-auto">
            This area is in active development. Reach out to your account contact for a preview
            of what&apos;s coming next.
          </p>
        </div>
      </div>
    </div>
  )
}

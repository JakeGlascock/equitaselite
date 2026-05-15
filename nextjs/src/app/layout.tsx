import type { Metadata } from 'next'
import { Playfair_Display, Inter, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

// Self-hosted via next/font: preloaded with the page, fallback-metric-matched
// to prevent CLS on font swap, and applied via CSS variables that the Tailwind
// fontFamily tokens reference.
const playfair = Playfair_Display({
  subsets:  ['latin'],
  weight:   ['400', '600', '700'],
  variable: '--font-display',
  display:  'swap',
})
const inter = Inter({
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600'],
  variable: '--font-body',
  display:  'swap',
})
const plexSans = IBM_Plex_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-data',
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'Equitas Elite',
  description: 'Institutional investor alignment platform',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${plexSans.variable}`}>
      <head>
        {/*
          Material Symbols can't go through next/font (it's a variable-font
          icon family). display=block hides the <span> text until the font
          loads so we never flash "dashboard" / "event" labels as raw text.
        */}
        {/*
          Self-hosted Material Symbols subset — only the 38 glyphs the app
          actually uses, ~48KB instead of the 3.8MB full variable font.
          @font-face lives in globals.css. Preload here so the woff2 starts
          downloading during initial HTML parse rather than after CSS parse,
          which is what eliminates the top-bar icon flicker on hard refresh.

          Glyphs currently bundled (regenerate the subset when this list
          changes — see globals.css comment for the workflow):
            account_balance, account_balance_wallet, arrow_back,
            arrow_forward, bar_chart, chat_bubble_outline, check, close,
            dashboard, event, expand_more, explore, fact_check, group,
            handshake, help, hourglass_empty, insights, lock, logout,
            mail, menu, more_horiz, notifications, notifications_off,
            person_raised_hand, place, query_stats, reply, schedule,
            search, settings, shield_person, support_agent, tune,
            verified, verified_user, visibility
        */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/material-symbols-outlined.woff2"
        />
      </head>
      <body className="bg-ee-bg text-ee-primary font-body antialiased">
        {children}
      </body>
    </html>
  )
}

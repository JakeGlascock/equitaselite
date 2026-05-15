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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Preload the actual Material Symbols woff2 file the CSS @font-face
          will request. Without this, the browser waits until it has parsed
          the stylesheet (next link below) before it knows the font URL,
          which leaves every top-bar icon as an empty box for ~200-500ms
          on first paint — the visible "flicker" on hard refresh.
          With the preload, the woff2 download starts during HTML parsing,
          so by the time the CSS resolves it the file is already cached.
          The hash in the URL changes when Google reissues the font (~once
          a year). If that happens, the preload becomes a no-op (no harm)
          and we re-pin to the new version.
        */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/materialsymbolsoutlined/v338/kJEhBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oFsLjBuVY.woff2"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ee-bg text-ee-primary font-body antialiased">
        {children}
      </body>
    </html>
  )
}

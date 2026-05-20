import type { CapacitorConfig } from '@capacitor/cli'

// Equitas Elite — Capacitor iOS wrapper (Phase M1, locked 2026-05-20).
//
// Hybrid build mode: the embedded WKWebView loads the production site
// directly via server.url. Always-current; no app-store update needed
// for content changes. The local www/index.html is only shown as a
// connection-loss fallback.
//
// Production EE backend lives at https://equitaselite.com — Cognito
// auth, Off-Market visibility, multi-role mandates, the public /try
// demo, and every other route work unchanged inside the WebView.

const config: CapacitorConfig = {
  appId:   'com.equitaselite.app',
  appName: 'Equitas Elite',
  webDir:  'www',

  server: {
    // Hybrid: point the WebView at the live site. To smoke-test the
    // local fallback page instead, comment this whole `server` block.
    url:       'https://equitaselite.com',
    // Allow only HTTPS — block any accidental cleartext traffic so a
    // misconfigured staging URL can't downgrade the connection.
    cleartext: false,
  },

  ios: {
    // Edge-to-edge: the WKWebView fills the screen, body bg paints
    // behind the status bar, and the top nav bars absorb the safe-area
    // inset via `padding-top: env(safe-area-inset-top)`. `'always'`
    // looked tidier at rest but didn't *clip* — content visibly
    // scrolled into the inset region above the body.
    contentInset: 'never',
    scrollEnabled: true,
    // Belt-and-braces: paints the WKWebView navy so any rendering gap
    // (e.g. before the body first paints) reads brand navy, not the
    // dark-mode system black.
    backgroundColor: '#031427',
  },
}

export default config

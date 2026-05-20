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
    // Disable content scrolling inertia inside the WebView when the
    // site already provides its own scroll containers (most of EE).
    contentInset: 'always',
    // The WKWebView's scrollIndicators stay visible in normal use.
    scrollEnabled: true,
  },
}

export default config

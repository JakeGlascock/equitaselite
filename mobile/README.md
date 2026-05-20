# mobile/

Capacitor iOS wrapper for Equitas Elite (Phase M1+, see
`project_equitaselite_mobile_plan` in memory).

## Architecture

Hybrid build mode: the embedded WKWebView loads
`https://equitaselite.com` directly. `www/index.html` is only shown as
a fallback when the connection is unreachable. There is no static
export of the Next.js app — the production site is the app.

## Daily workflow

```bash
cd mobile

# After any change to capacitor.config.ts or www/
npx cap sync ios

# Open the iOS project in Xcode (then click ▶ Run to launch the simulator)
npx cap open ios
```

## Adding a Capacitor plugin

```bash
npm install @capacitor/<plugin-name>
npx cap sync ios
```

Then add usage in `www/` (or, more usefully for hybrid, expose a
JS shim on the production site that the WebView can call via Capacitor).

## First-time setup on a new machine

```bash
# 1. Install JS dependencies
cd mobile && npm install

# 2. Open in Xcode and run on the iOS Simulator
npx cap open ios
```

Capacitor 7 uses Swift Package Manager for plugin management (no
CocoaPods needed for the core project). The first Xcode build will
resolve SPM dependencies automatically. If you later add a Capacitor
plugin that still ships only via CocoaPods, run `brew install
cocoapods` and follow that plugin's docs.

## App identifiers

| Setting       | Value                                |
|---------------|--------------------------------------|
| App ID        | `com.equitaselite.app`               |
| Display name  | `Equitas Elite`                      |
| Bundle ID     | `com.equitaselite.app` (matches App ID) |
| Hybrid URL    | `https://equitaselite.com`           |

## Phases

- **M0** — boilerplate legal (/terms + /privacy) — shipped 2026-05-20
- **M1** — Capacitor scaffold (this directory) — in progress
- **M2** — core native capabilities (push + Face ID + share)
- **M2b** — maximalist §4.2 belt-and-braces (widget + contacts + haptics + calendar + Spotlight)
- **M3** — Universal Links + polish
- **M4** — App Store submission

See `project_equitaselite_mobile_plan.md` in memory for the full
plan + locked decisions.

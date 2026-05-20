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

## Running on a physical iPhone (no push required)

For UI / navigation testing on hardware, you don't need any of the
APNs setup. Plug the phone in (or pair wirelessly via
Window → Devices & Simulators in Xcode), then:

1. Xcode → Top device selector → pick the connected phone.
2. App target → Signing & Capabilities → set Team to your personal
   Apple Developer team. Xcode generates a provisioning profile
   automatically.
3. ▶ Run. First launch will fail to launch the app — trust the
   developer cert on the phone: Settings → General → VPN & Device
   Management → tap your developer cert → Trust.
4. Re-run. App opens, loads `https://equitaselite.com` in the
   embedded WebView. Sign in with a real account to exercise the
   authed flows.

Push will fire `[capacitor] push permission not granted` in console
until the APNs key + SNS Platform Application + `terraform apply` are
done — see the handoff list in `project_equitaselite_mobile_plan.md`.
The app itself still works without push.

## Phases

- **M0** — boilerplate legal (/terms + /privacy) — shipped 2026-05-20
- **M1** — Capacitor scaffold + safe-area chrome — shipped 2026-05-20
- **M2** — push + Face ID + share — shipped 2026-05-20 (SNS transport
  live behind `PUSH_PROVIDER=sns`; stub mode is the default)
- **M2b** — maximalist §4.2 belt-and-braces (widget + contacts + haptics + calendar + Spotlight) — deferred
- **M3** — Universal Links + polish — AASA route shipped; Xcode
  Associated Domains capability pending
- **M4** — App Store submission — icon + splash assets shipped;
  screenshots + listing pending

See `project_equitaselite_mobile_plan.md` in memory for the full
plan + locked decisions + Apple-side handoff list.

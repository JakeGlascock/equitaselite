# ARCHITECTURE.md — Equitas Elite

Technical architecture documentation covering system design, data flow, module structure, and the production upgrade path.

---

## System Overview

Equitas Elite is a **single-tier client-side application**. There is no server, no API, and no database. All logic executes in the browser; all state persists in `localStorage`. The application is served as static files from GitHub Pages.

```
Browser
  └── GitHub Pages (static file host)
        ├── index.html          ← entry point
        ├── shared.js           ← shared module (loaded by each page)
        ├── [page].html × 10   ← authenticated pages
        └── logo.png            ← brand asset
```

This architecture is intentional for the prototype phase — zero infrastructure, zero cost, deployable in seconds. The tradeoff is that all data is local to a single browser session and all logic is visible in the client.

---

## Module System

There is no bundler or module system. Pages share logic through a single **global script** — `shared.js` — which is loaded via a `<script src="shared.js">` tag at the bottom of every authenticated page body. All exports are global functions and constants on the `window` object.

### Load Order (per page)

```
1. <script> tailwind.config = {...}        ← must be first, before Tailwind CDN
2. <script src="cdn.tailwindcss.com">      ← reads config, generates utility classes
3. Google Fonts <link>                     ← Playfair Display, Inter, IBM Plex Sans
4. Material Symbols <link>                 ← icon font
5. Page HTML renders                       ← placeholder divs for nav injection
6. <script src="shared.js">               ← defines all globals
7. <script> init() { eeBootstrap(...) }    ← page-specific logic runs last
```

The Tailwind config **must** precede the CDN script because the CDN reads `window.tailwind.config` synchronously on load. This is why the config cannot live in `shared.js`.

---

## Page Architecture

Every authenticated page follows an identical structural contract:

```html
<!DOCTYPE html>
<html class="dark">
<head>
  <!-- Tailwind config (must be before CDN) -->
  <!-- CDN scripts and font links -->
  <!-- Page-specific styles -->
</head>
<body class="bg-background text-on-surface font-body">

  <!-- Nav injection targets -->
  <div id="ee-topbar"></div>
  <div class="flex pt-14 min-h-screen">
    <div id="ee-sidebar"></div>
    <main class="flex-1 lg:ml-60 px-5 md:px-8 py-8 pb-24 lg:pb-8">
      <!-- Page content -->
    </main>
  </div>
  <div id="ee-mobile-nav"></div>

  <!-- Modal injection targets (filled by eeBootstrap) -->

  <script src="shared.js"></script>
  <script>
    function init() {
      const user = eeBootstrap('this-page.html');
      if (!user) return;
      // Page-specific logic
    }
    init();
  </script>
</body>
</html>
```

Pre-auth pages (`index.html`, `onboarding.html`) are exempt — they have standalone layouts and do not call `eeBootstrap`.

---

## shared.js Architecture

`shared.js` is the application's core module. It is structured in seven layers:

```
shared.js
  ├── 1. Design Tokens        EE_COLORS object (reference, not injected)
  ├── 2. Mock Data            MOCK_FAMILY_OFFICES, MOCK_ANGELS, MOCK_DEALS, MOCK_NOTIFICATIONS
  ├── 3. Auth                 eeGetUser, eeCheckAuth, eeLogout
  ├── 4. Scoring              eeMatchScore, eeScoreLabel, eeScoreColors
  ├── 5. Nav Generators       eeSidebarHTML, eeTopbarHTML, eeMobileNavHTML
  ├── 6. Modal System         eeOpenModal, eeCloseModal, eeInject*, eeOpen*, handlers
  └── 7. Bootstrap            eeBootstrap (orchestrates layers 3–6)
```

### Layer Dependencies

```
eeBootstrap
  ├── calls eeCheckAuth        (layer 3)
  ├── calls eeSidebarHTML      (layer 5) → reads MOCK_NOTIFICATIONS (layer 2)
  ├── calls eeTopbarHTML       (layer 5) → reads MOCK_NOTIFICATIONS (layer 2)
  ├── calls eeMobileNavHTML    (layer 5)
  └── calls eeInject* × 6     (layer 6)

Page init functions
  ├── call eeBootstrap
  ├── read MOCK_* arrays       (layer 2)
  ├── call eeMatchScore        (layer 4)
  ├── call eeScoreLabel        (layer 4)
  ├── call eeScoreColors       (layer 4)
  └── call eeOpen* / eeShowToast (layer 6)
```

---

## Authentication Architecture

Authentication is simulated. There is no token, no session, no server verification.

### Login Flow

```
index.html
  └── handleLogin(event)
        ├── reads ee_users from localStorage
        ├── finds matching email + password
        ├── writes ee_current_user to localStorage
        └── redirects →
              onboarding.html  (if user.onboarded !== true)
              dashboard.html   (otherwise)
```

### Auth Guard

Every authenticated page calls `eeBootstrap()` which calls `eeCheckAuth()`:

```
eeCheckAuth()
  ├── reads ee_current_user from localStorage
  ├── if null → window.location.href = 'index.html'  (redirect)
  └── if present → returns user object
```

There is no token expiry, no refresh, and no server-side session. Logging out clears `ee_current_user` from localStorage and redirects to `index.html`.

### Demo Seed Data

`index.html` seeds two demo accounts into `ee_users` on every load if they don't already exist:

```js
// Seeded on index.html load
[
  { email: 'demo@angelinvestor.com', password: 'demo123', type: 'angel', onboarded: true, ... },
  { email: 'demo@familyoffice.com',  password: 'demo123', type: 'family_office', onboarded: true, ... }
]
```

---

## Matching Algorithm Architecture

The matching score is a **weighted multi-dimensional similarity function**. It runs entirely client-side in JavaScript.

### `eeMatchScore(a, b)` — Simple Score (shared.js)

Used across all list and card views. Returns a single integer 0–99.

```
Input:  Two UserProfile objects (a = current user, b = candidate)
Output: Integer 0–99

Dimensions:
  Sector overlap   → Jaccard similarity × 40
  Stage alignment  → Jaccard similarity × 30
  Check size       → Binary range overlap × 20
  Geography        → Exact match or Global × 10

Cap: Math.min(score, 99)  — never returns 100
```

### `detailedScore(a, b)` — Dimensional Score (alignment.html)

Used only on the Alignment Report. Returns per-dimension scores for the breakdown visualization.

```
Input:  Two UserProfile objects
Output: {
  overall:     0–99  (weighted composite)
  sectorScore: 0–100 (Jaccard × 100)
  stageScore:  0–100 (Jaccard × 100)
  checkScore:  0–100 (range overlap ratio × 100)
  geoScore:    20 | 100
  riskScore:   0 | 50 | 100 (Conservative/Moderate/Aggressive alignment)
  sectorOverlap: string[]  (shared sector names)
}
```

### Score Classification

```
eeScoreLabel(score):
  ≥ 85 → 'Exceptional'
  ≥ 70 → 'Strong'
  ≥ 55 → 'Good'
  < 55 → 'Moderate'

eeScoreColors(score):
  ≥ 85 → { text: 'text-tertiary',          bg: 'bg-tertiary/15 border-tertiary/30',   bar: '#4edea3' }
  ≥ 70 → { text: 'text-secondary',         bg: 'bg-secondary/15 border-secondary/30', bar: '#e9c176' }
  < 70 → { text: 'text-on-surface-variant', bg: 'bg-surface-container ...',            bar: '#909097' }
```

---

## State Management Architecture

There is no state management library. State flows through `localStorage` and direct DOM manipulation.

### localStorage as the Data Layer

```
ee_users            []UserProfile     All registered accounts
ee_current_user     UserProfile       The active session
ee_selected_candidate UserProfile     Passed from list → detail view
```

### Cross-Page Data Flow

```
dashboard.html / discovery.html
  └── user clicks a match card
        └── openAlignment(candidate)
              ├── localStorage.setItem('ee_selected_candidate', JSON.stringify(candidate))
              └── window.location.href = 'alignment.html'

alignment.html
  └── init()
        ├── user = eeGetUser()            ← current user from localStorage
        ├── candidate = localStorage.getItem('ee_selected_candidate')
        └── renderReport(user, candidate) ← generates full alignment report
```

### In-Page State

Page-level state (filter state, view mode, active tab) is held in JavaScript variables scoped to the page's `<script>` block. It does not persist across navigation — each page load starts fresh from localStorage.

---

## Navigation Architecture

Navigation is injected at runtime by `eeBootstrap`. The three nav surfaces are generated as HTML strings and replace their placeholder `<div>` elements via `outerHTML` assignment.

### Nav Surfaces

| Surface | Element ID | Visibility | Content |
|---------|-----------|------------|---------|
| Topbar | `ee-topbar` | Always | Logo, primary nav links (desktop), New Deal, notifications, avatar |
| Sidebar | `ee-sidebar` | `lg:` only | User profile, all nav links, Join Syndicate, Settings, Sign Out |
| Mobile Nav | `ee-mobile-nav` | `< lg` only | 5 primary destinations as icon+label tabs |

### Active Page Highlighting

`eeBootstrap(activePage)` passes the active page filename to all three nav generators. Each generator compares `activePage` to each link's `href` and applies active styling to the matching item:

```js
// Sidebar example
activePage === p.href
  ? 'bg-secondary/12 text-secondary border-r-2 border-secondary'  // active
  : 'text-on-surface-variant hover:bg-surface-container'           // inactive
```

`alignment.html` uses `'deal-room.html'` as its active page since it is accessed from the Deal Room flow and has no dedicated sidebar entry.

---

## Modal Architecture

All modals are injected into `document.body` by `eeBootstrap` via six `eeInject*` functions. They are appended once per page load and persist for the session.

### Modal Lifecycle

```
eeBootstrap()
  └── eeInjectNewDealModal()       → appends #new-deal-modal (hidden)
  └── eeInjectNotificationsDrawer() → appends #notifications-drawer (hidden)
  └── eeInjectMessageModal()       → appends #message-modal (hidden)
  └── eeInjectInviteModal()        → appends #invite-modal (hidden)
  └── eeInjectUploadModal()        → appends #upload-modal (hidden)
  └── eeInjectSyndicateModal()     → appends #syndicate-modal (hidden)

eeOpenModal(id)   → el.classList.remove('hidden'); el.classList.add('flex')
eeCloseModal(id)  → el.classList.add('hidden');    el.classList.remove('flex')
```

### Backdrop Click Dismissal

A single document-level click listener in `shared.js` handles backdrop dismissal for all modals. Each modal's backdrop div has an `onclick="eeCloseModal('modal-id')"` attribute.

---

## Rendering Architecture

Pages use **direct DOM manipulation** — `innerHTML` assignment and `insertAdjacentHTML`. There is no virtual DOM, no diffing, and no reactivity.

### Render Patterns

| Pattern | Used In | Description |
|---------|---------|-------------|
| `el.innerHTML = html` | All pages | Full section re-render from a JS template literal |
| `el.outerHTML = html` | `eeBootstrap` | Replace placeholder div with injected nav |
| `insertAdjacentHTML('beforeend', html)` | Modal injection | Append modal HTML to body once |
| `el.style.property = value` | Score rings, bars | Animate SVG and bar fills after render |

### SVG Animation Pattern

Score rings and bar charts are rendered with their animated properties at their start state, then updated after a short `setTimeout` to trigger CSS transitions:

```js
// Render with start state
`<circle style="stroke-dashoffset: ${circleC}"/>`  // fully hidden

// Animate after render
setTimeout(() => {
  document.getElementById('score-ring').style.strokeDashoffset = offset;
}, 100);
```

---

## Asset Architecture

```
equitaselite/
  logo.png         ← Brand mark (referenced by relative path in shared.js and HTML files)
```

All other assets (icons, fonts) are loaded from external CDNs:
- **Tailwind CSS** — `cdn.tailwindcss.com`
- **Google Fonts** — `fonts.googleapis.com` (Playfair Display, Inter, IBM Plex Sans)
- **Material Symbols** — `fonts.googleapis.com` (icon font, variable weight/fill)

The application has no build step and no asset pipeline. `logo.png` is served directly by GitHub Pages.

---

## Production Architecture (Recommended)

The current client-side prototype should migrate to the following architecture before onboarding real users:

```
                    ┌─────────────────────────────┐
                    │         Vercel (CDN)         │
                    │    Next.js App Router (SSR)  │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼────────┐  ┌────────▼───────┐  ┌────────▼───────┐
    │  Supabase Auth   │  │  Supabase DB   │  │Supabase Storage│
    │  (MFA, OAuth)    │  │  (PostgreSQL + │  │ (Document Vault│
    │                  │  │   Row-Level    │  │  signed URLs)  │
    │                  │  │   Security)    │  │                │
    └──────────────────┘  └───────────────┘  └────────────────┘
```

### Migration Priority Order

1. **Auth** — Replace `localStorage` login with Supabase Auth (MFA from day one)
2. **User Profiles** — Move `ee_users` to `profiles` table with RLS (users see only their own row)
3. **Matching** — Move `eeMatchScore` to a Supabase Edge Function or Next.js API route
4. **Deals** — Move `MOCK_DEALS` to a `deals` table with participant-based RLS
5. **Documents** — Move document vault to Supabase Storage with signed URL access
6. **Notifications** — Replace `MOCK_NOTIFICATIONS` with a `notifications` table + Supabase Realtime
7. **Chat** — Replace the mocked secure chat with Supabase Realtime subscriptions on a `messages` table

### What Stays the Same

- All Tailwind CSS classes and design tokens
- All page layouts and component structure
- The scoring algorithm logic (ported to TypeScript)
- The `DESIGN.md` design system
- The `equitaselite.com` domain (update DNS from GitHub Pages IPs to Vercel)

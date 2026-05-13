# AGENTS.md — Equitas Elite

Instructions for AI agents working on this codebase.

---

## What This Is

Equitas Elite is a **pure static HTML application** — no framework, no bundler, no backend. Every page is a self-contained `.html` file. All shared logic lives in `shared.js`. Data persists in `localStorage`. There is no build step; files are served directly to the browser.

---

## Architecture Rules

### One shared file, many pages
`shared.js` is the single source of truth for:
- Mock data (`MOCK_FAMILY_OFFICES`, `MOCK_ANGELS`, `MOCK_DEALS`, `MOCK_NOTIFICATIONS`)
- Auth (`eeGetUser`, `eeCheckAuth`, `eeLogout`)
- Match scoring (`eeMatchScore`, `eeScoreLabel`, `eeScoreColors`)
- Nav HTML generation (`eeSidebarHTML`, `eeTopbarHTML`, `eeMobileNavHTML`)
- All modal inject/open functions
- Toast notifications (`eeShowToast`)
- Bootstrap (`eeBootstrap`)

**Never duplicate any of these in a page file.** If a page needs mock data or scoring, import it from `shared.js`.

### Tailwind config must be inline per page
Tailwind CDN requires the config object to exist in a `<script>` block **before** the CDN `<script>` tag loads. The config cannot be shared via `shared.js`. Every page must include the full `tailwind.config = { ... }` block. Copy it exactly from an existing page — do not modify the token values.

### The bootstrap pattern
Every authenticated page must follow this exact structure:

```html
<div id="ee-topbar"></div>
<div class="flex pt-14 min-h-screen">
  <div id="ee-sidebar"></div>
  <main class="flex-1 lg:ml-60 px-5 md:px-8 py-8 pb-24 lg:pb-8">
    <!-- page content -->
  </main>
</div>
<div id="ee-mobile-nav"></div>

<script src="shared.js"></script>
<script>
function init() {
  const user = eeBootstrap('this-page.html');
  if (!user) return;
  // page-specific logic
}
init();
</script>
```

`eeBootstrap(activePage)` replaces the three placeholder divs with the shared topbar, sidebar, and mobile nav, then injects all modals. The `activePage` string must exactly match one of the nav href values (`dashboard.html`, `discovery.html`, `deal-room.html`, `portfolio.html`, `network.html`, `reports.html`) so the correct nav item is highlighted.

### Login and onboarding are exempt
`index.html` and `onboarding.html` do not use `eeBootstrap` — they are pre-auth pages with their own standalone layouts.

---

## Design System

All visual decisions must follow `DESIGN.md`. Key constraints:

| Token | Value | Use |
|-------|-------|-----|
| Background | `#031427` | Page canvas only |
| Gold (`secondary`) | `#e9c176` | Primary CTAs, active nav, prestige accents |
| Emerald (`tertiary`) | `#4edea3` | Success states, 85%+ scores, verified badges |
| Primary text | `#d3e4fe` | Body text on dark backgrounds |
| Glass panel | `rgba(16,32,52,0.6)` + `backdrop-filter:blur(12px)` + `1px solid rgba(69,70,77,0.5)` | All content cards |

**Score badge colors** must always use `eeScoreColors(score)` from `shared.js` — never hardcode them.

**Fonts:** Playfair Display for headings, Inter for body, IBM Plex Sans for labels/data. All three are loaded via Google Fonts on every page.

**Border radii:** Cards `rounded-xl` (1rem), buttons `rounded-lg` (0.5rem), chips `rounded-full`. Never use pill-shaped buttons.

**Label caps pattern:** Section headers use `font-label text-[10px] tracking-widest uppercase text-on-surface-variant`. This is the primary hierarchy device — do not increase font size instead.

---

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `ee_current_user` | JSON object | The logged-in user's full profile |
| `ee_users` | JSON array | All registered users |
| `ee_selected_candidate` | JSON object | The match profile passed to `alignment.html` |

`eeGetUser()` reads `ee_current_user`. `eeCheckAuth()` redirects to `index.html` if null.

---

## Modals

All modals are injected by `eeBootstrap` via `shared.js`. To open them from any page:

| Modal | Open function |
|-------|--------------|
| New Deal | `eeOpenNewDeal()` |
| Notifications drawer | `eeOpenNotifications()` |
| Send Message | `eeOpenMessage(recipientName)` |
| Invite Member | `eeOpenModal('invite-modal')` |
| Upload Document | `eeOpenModal('upload-modal')` |
| Join Syndicate | `eeOpenModal('syndicate-modal')` |

Never inject modals manually in page files — they are always provided by `eeBootstrap`.

---

## Adding a New Page

1. Copy the structure of an existing page (e.g. `portfolio.html`)
2. Keep the full Tailwind config block unchanged
3. Use the bootstrap pattern — three placeholder divs + `eeBootstrap('new-page.html')`
4. Add the page to the nav in `shared.js`:
   - `eeSidebarHTML`: add to the `pages` array
   - `eeTopbarHTML`: add to `navLinks` if it belongs in the top nav
   - `eeMobileNavHTML`: add to `items` if it belongs in the mobile bar
5. Do not add mock data or scoring functions to the page — use what `shared.js` exports

---

## Adding a New Modal

1. Write `eeInjectXxxModal()` in `shared.js` — appends HTML to `document.body`
2. Write `eeOpenXxx()` calling `eeOpenModal('xxx-modal')`
3. Call `eeInjectXxxModal()` inside `eeBootstrap()` so it's available on every page
4. Use `eeCloseModal('xxx-modal')` for the close/cancel buttons
5. Call `eeShowToast(msg)` on success

---

## Modifying Shared Mock Data

`MOCK_FAMILY_OFFICES` and `MOCK_ANGELS` in `shared.js` are the canonical counterpart profiles used across Dashboard, Discovery, Matches, and Alignment pages. Any change to these arrays affects all pages simultaneously. Profile objects must include:

```js
{
  type: 'family_office' | 'angel',
  name, firm, title, location, aum,
  minCheck, maxCheck,       // numbers in $M
  stages: [],               // 'Pre-Seed'|'Seed'|'Series A'|'Series B'|'Series B+'|'Growth'
  sectors: [],              // see sector list below
  geography,                // 'North America'|'Europe'|'Asia-Pacific'|'Middle East'|'Global'
  riskTolerance,            // 'Conservative'|'Moderate'|'Aggressive'
  // family_office only:
  mandate, concentration,
  // angel only:
  expectedReturn, timeline
}
```

Valid sectors: `FinTech`, `Deep Tech`, `Life Sciences`, `Clean Energy`, `SaaS`, `AI / ML`, `Healthcare`, `Defense Tech`, `Consumer`, `Real Estate`

---

## What Not To Do

- **Do not** add a backend, database, or server-side logic — the app is intentionally client-only
- **Do not** install npm packages or introduce a build step
- **Do not** use `alert()` or `confirm()` — use `eeShowToast()` or a modal instead
- **Do not** duplicate `MOCK_FAMILY_OFFICES`, `MOCK_ANGELS`, or scoring functions in page files
- **Do not** hardcode nav HTML in page files — it must come from `shared.js`
- **Do not** use pill-shaped buttons (`rounded-full` on buttons is reserved for chips only)
- **Do not** use colors outside the design token set — no arbitrary hex values in HTML
- **Do not** add comments explaining what the code does — only add comments for non-obvious constraints or workarounds

---

## Verification Checklist

Before considering a change complete:

- [ ] Page uses `eeBootstrap('page.html')` with the correct active page string
- [ ] No mock data or scoring functions duplicated from `shared.js`
- [ ] Tailwind config block is present and unchanged
- [ ] All three fonts are loaded in `<head>`
- [ ] New modals are registered in `eeBootstrap()` in `shared.js`
- [ ] Score colors use `eeScoreColors()`, not hardcoded values
- [ ] No `alert()` calls — use `eeShowToast()` or modals
- [ ] Glass panel class applied to all content cards
- [ ] `label-caps` pattern used for section headers

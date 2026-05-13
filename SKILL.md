# SKILL.md — Equitas Elite

Reusable prompt patterns and task recipes for AI agents and developers working on this codebase. Each skill is a concrete, copy-paste-ready instruction that produces a predictable result.

---

## Page Skills

### Add a New Page

```
Create a new authenticated page called [name].html for Equitas Elite.

The page should:
- Follow the eeBootstrap pattern from AGENTS.md
- Use '[name].html' as the activePage argument
- Add it to the sidebar nav in shared.js (pages array) and mobile nav (items array)
- Match the glass-panel card style and label-caps section headers from DESIGN.md
- Include a page header with an eyebrow label, font-display headline, and subtitle
- Pull any needed data from MOCK_* arrays in shared.js — do not add new mock data to the page file

Page purpose: [describe what the page should show]
```

### Add a Section to an Existing Page

```
Add a new section to [page].html in Equitas Elite.

The section should:
- Be wrapped in a glass-panel rounded-xl p-5 container
- Use the label-caps eyebrow pattern for the section title
- Follow the existing spacing rhythm on the page (gap-6 between sections)
- Not introduce any new colors, fonts, or border-radius values outside DESIGN.md

Section content: [describe what to show]
```

---

## Component Skills

### Add a New Modal

```
Add a new modal to shared.js in Equitas Elite called [name].

It should:
- Follow the eeInjectXxxModal() / eeOpenXxx() / eeCloseModal() pattern
- Be injected inside eeBootstrap() so it's available on all pages
- Use bg-surface-container-low, border-outline-variant/60, rounded-xl for the panel
- Have a header with a label-caps eyebrow and font-display title, plus a close button
- Call eeShowToast() on successful submission
- Be openable via eeOpenModal('[name]-modal')

Modal purpose: [describe what it does]
Fields: [list any form fields needed]
```

### Add a Toast Notification

```
Show a toast notification in Equitas Elite after [action].
Use eeShowToast('[message]') for success or eeShowToast('[message]', 'error') for errors.
Do not use alert() or any other notification mechanism.
```

### Add a Score Badge

```
Display an alignment score badge for a score of [value] in [page].html.

Use eeScoreColors(score) from shared.js to get the correct color classes:
- bg, text, bar properties returned
- Do not hardcode color values
- Pair it with eeScoreLabel(score) for the text label (Exceptional / Strong / Good / Moderate)
```

---

## Data Skills

### Add a Mock Profile

```
Add a new [angel | family_office] profile to MOCK_[ANGELS | FAMILY_OFFICES] in shared.js.

The profile must include all required fields from the UserProfile schema in PROTOCOL.md:
type, name, firm, title, location, aum, minCheck, maxCheck, stages[], sectors[], geography, riskTolerance
Plus role-specific fields (expectedReturn + timeline for angel; mandate + concentration for family_office).

Use only valid sector values: FinTech, Deep Tech, Life Sciences, Clean Energy, SaaS, AI / ML, Healthcare, Defense Tech, Consumer, Real Estate
Use only valid geography values: North America, Europe, Asia-Pacific, Middle East, Global

Profile details: [describe the profile]
```

### Update the Scoring Algorithm

```
Update the eeMatchScore(a, b) function in shared.js for Equitas Elite.

Current weights: Sector overlap 40%, Stage alignment 30%, Check size 20%, Geography 10%.
Max score is capped at 99.

The function must remain pure (no side effects, no DOM access) and return a number 0–99.
Update eeScoreLabel() and eeScoreColors() thresholds if the scoring range changes.

Requested change: [describe the change]
```

---

## Deployment Skills

### Commit and Deploy

```
Commit all current changes to the Equitas Elite repo and push to GitHub.

Use a clear imperative commit message scoped to what changed.
Run: git add [files] && git commit -m "[message]" && git push

The site auto-deploys to equitaselite.com via GitHub Pages within ~60 seconds.
```

### Deploy a Single File

```
Commit and push only [filename] to the Equitas Elite GitHub repo.
Message: "[imperative description of the change]"
```

---

## Design Skills

### Audit a Page for Design Compliance

```
Audit [page].html in Equitas Elite for design system compliance.

Check against DESIGN.md and flag any violations:
- Hardcoded hex colors not in the token set
- alert() calls instead of eeShowToast()
- Missing font-label / font-display / font-body class usage
- Border radius values inconsistent with the shape system
- Interactive elements below 44px touch target
- Nav HTML inlined instead of using eeBootstrap()
- Mock data or scoring functions duplicated from shared.js

Report violations with line numbers and the correct fix for each.
```

### Match a Design Reference

```
Implement the UI shown in [description] for Equitas Elite.

Follow DESIGN.md strictly:
- Dark background: bg-background (#031427)
- Cards: glass-panel class (rgba(16,32,52,0.6) + backdrop-blur + 1px border)
- Primary CTA: bg-secondary text-on-secondary (gold)
- Success indicators: text-tertiary / bg-tertiary/15 (emerald)
- Section headers: font-label text-[10px] tracking-widest uppercase text-on-surface-variant
- Headings: font-display
- Body: font-body
- Labels/data: font-label
```

---

## Refactor Skills

### Migrate Inline Nav to shared.js

```
Update [page].html to use the shared.js bootstrap pattern.

1. Replace the inline <header> with <div id="ee-topbar"></div>
2. Replace the inline <aside> with <div id="ee-sidebar"></div>
3. Replace the inline mobile <nav> with <div id="ee-mobile-nav"></div>
4. Add <script src="shared.js"></script> before the page's <script> block
5. Update init() to call eeBootstrap('[page].html') and remove any manual nav population
6. Remove any MOCK_* arrays or scoring functions duplicated from shared.js
7. Replace matchScore() calls with eeMatchScore(), scoreLabel() with eeScoreLabel(), scoreColors() with eeScoreColors()
```

### Remove a Deprecated Function

```
Remove the function [functionName] from [file] in Equitas Elite.

Before removing:
1. Confirm it is not called anywhere with: grep -rn "[functionName]" .
2. If called, replace each call site with the correct shared.js equivalent
3. Remove the function definition
4. Verify the page still works by opening it in a browser
```

---

## Upgrade Skills

### Scaffold Next.js Migration

```
Scaffold the Next.js + Supabase migration for Equitas Elite.

Create a /nextjs directory (do not modify the existing HTML files) with:
- next.config.js configured for Tailwind and App Router
- tailwind.config.js with all EE_COLORS tokens from shared.js
- /app/layout.tsx with the shared topbar, sidebar, and mobile nav as React components
- /app/page.tsx as the login page (port of index.html)
- /lib/supabase.ts with the Supabase client setup
- /lib/scoring.ts with the eeMatchScore algorithm as a typed TypeScript function
- /types/index.ts with the UserProfile interface from PROTOCOL.md

Preserve all visual design exactly — same Tailwind classes, same fonts, same colors.
```

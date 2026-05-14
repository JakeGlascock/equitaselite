---
name: Equitas Elite
colors:
  background: '#031427'
  surface: '#031427'
  surface-dim: '#031427'
  surface-bright: '#2a3a4f'
  surface-container-lowest: '#000f21'
  surface-container-low: '#0b1c30'
  surface-container: '#102034'
  surface-container-high: '#1b2b3f'
  surface-container-highest: '#26364a'
  surface-variant: '#26364a'
  on-surface: '#d3e4fe'
  on-surface-variant: '#c6c6cd'
  outline: '#909097'
  outline-variant: '#45464d'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  secondary: '#e9c176'
  on-secondary: '#412d00'
  secondary-container: '#604403'
  on-secondary-container: '#dab36a'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#001c10'
  on-tertiary-container: '#009365'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  data-mono:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base-unit: 4px
  margin-mobile: 20px
  gutter-mobile: 12px
  touch-target-min: 44px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  container-max: 1280px
  sidebar-width: 240px
---

## Brand & Style

Equitas Elite is a private investor alignment platform for Angel Investors and Family Offices. The brand personality is **Stately, Precise, and Prescient** — balancing the heritage of traditional institutional finance with the velocity of modern fintech.

The visual style follows a **Refined Corporate** approach with **Glassmorphic Tonal** depth. Deep, layered backgrounds create a sense of security and infinite depth, while the interface avoids unnecessary decoration in favor of data clarity and high-contrast legibility. The emotional response should be one of absolute confidence and "quiet luxury" — the interface feels like a bespoke digital private bank.

## Colors

The palette is anchored in deep Midnight Navy (`#031427`) to establish a high-trust institutional foundation.

- **Background / Surface (`#031427`):** The darkest base layer — the canvas everything sits on.
- **Surface Containers (`#000f21` → `#26364a`):** A 5-step tonal scale used to create depth hierarchy between cards, panels, and interactive elements without shadows.
- **Primary (`#bec6e0`):** Soft steel-blue used for body text, icons, and secondary interactive elements. Represents clarity and precision.
- **Secondary / Gold (`#e9c176`):** Antique Gold — the prestige accent. Used for active nav states, high-value CTAs ("New Deal", "Join Syndicate"), score badges, and brand marks. Applied sparingly to maintain exclusivity.
- **Tertiary / Emerald (`#4edea3`):** Precision Emerald — the sole success and positive-performance indicator. Used for top-tier alignment scores (85%+), verified status badges, funding progress, and upward trend indicators.
- **On-Surface (`#d3e4fe`):** Primary readable text on dark backgrounds. A cool, slightly blue-tinted white to harmonize with the navy base.
- **Outline Variant (`#45464d`):** Used for card borders and panel dividers. Provides structure without visual aggression.

## Typography

Three typefaces work together to balance authority, utility, and precision.

- **Playfair Display** — All major headings, firm names, section titles, and editorial moments. Its high-contrast serifs evoke traditional financial broadsheets and signal premium heritage.
- **Inter** — All body copy, navigation labels, metric values, and UI prose. High x-height ensures legibility at small sizes on dark backgrounds.
- **IBM Plex Sans** — All data labels, category chips, table headers, and `label-caps` elements. Its structured, technical appearance is ideal for tabular numbers and uppercase tracking labels. OpenType `tnum` feature is used for all currency and percentage columns.

The `label-caps` style (IBM Plex Sans 11px / 600 weight / 0.08em letter-spacing / uppercase) is the primary structural device — it creates clear hierarchy between section headers and content without changing font size.

## Layout & Spacing

The layout uses a **Fixed Sidebar + Fluid Content** model on desktop and a single-column stack on mobile.

- **Sidebar:** 240px fixed-width, persistent left rail with user profile, page navigation, and syndicate access. Hidden on mobile.
- **Topbar:** 56px fixed-height header with brand mark, primary nav links (desktop), New Deal CTA, notifications, and user avatar.
- **Content area:** `lg:ml-60` offset to clear the sidebar. Max-width `1280px`, centered. Standard padding `px-5 md:px-8 py-8`.
- **Mobile nav:** Fixed bottom bar with 5 primary destinations. 64px height with 44px minimum touch targets.
- **Grid:** 12-column on desktop for dashboard and deal-flow views. Single-column on mobile with 20px outer margins.
- **Spacing rhythm:** 4px base unit. Internal card padding 20px. Section gaps 24px. Major section breaks 48px+.

## Elevation & Depth

Depth is communicated through **Tonal Layering** rather than shadows — a "flat-plus" approach that reads as tactile and premium without visual noise.

1. **Level 0 — Canvas (`#031427`):** The background. Never used for interactive surfaces.
2. **Level 1 — Cards / Panels (`#0b1c30` + 1px `#45464d` border):** Standard glass panels using `background: rgba(16,32,52,0.6); backdrop-filter: blur(12px); border: 1px solid rgba(69,70,77,0.5)`.
3. **Level 2 — Active / Hover:** Border darkens to `rgba(69,70,77,0.8)` and a subtle ambient shadow appears (`0px 4px 20px rgba(3,20,39,0.4)`).
4. **Level 3 — Modals / Drawers:** `bg-surface-container-low` with 60% black backdrop blur overlay. Full `shadow-2xl` permitted.

## Shapes

The shape language is **Refined-Modern** — softer than legacy institutional platforms but more formal than consumer fintech.

- **Cards:** `0.5rem` (8px) radius — clear containment with a friendly mobile silhouette.
- **Buttons:** `0.5rem` (8px) — sturdy and professional.
- **Chips / Badges:** `9999px` (full pill) — visually distinguishes non-actionable tags from buttons.
- **Input fields:** `0.5rem` (8px) with bottom-border glow on focus (Gold for standard, Emerald for success states).
- **Modals:** `0.75rem` (12px) to create clear visual separation from the page layer.

Pill-shaped buttons are strictly avoided — pills are reserved for chips only, maintaining the professional rigor of the system.

## Components

**Navigation**
The fixed sidebar is the primary navigation surface. Active page is indicated by a Gold right-border (`border-r-2 border-secondary`) and `bg-secondary/12` fill. Icons use `FILL 1` style on active states. The topbar includes a condensed primary nav for desktop.

**Buttons**
- *Primary:* Gold background (`bg-secondary`) with `on-secondary` (navy) text. Used for the single most important action per view.
- *Secondary / Outline:* `border border-secondary/50 text-secondary`. Used for secondary CTAs alongside a primary button.
- *Ghost:* `border border-outline-variant text-on-surface-variant`. Used for destructive or low-priority actions.
- *Tertiary / Syndicate:* `bg-tertiary/15 border-tertiary/30 text-tertiary`. Exclusive to syndicate and network join actions.

**Score Badges**
Match scores use a 4-tier band system (see `src/lib/scoring.ts`):
- **80+ Strong Fit:** Emerald `#4edea3`
- **65–79 Good Fit:** Gold `#e9c176`
- **50–64 Possible Fit:** Amber `#f59e0b`
- **<50 Low Fit:** Red `#ef4444`

**Glass Panels**
The primary card surface: `background: rgba(16,32,52,0.6); backdrop-filter: blur(12px); border: 1px solid rgba(69,70,77,0.5)`. Applied to all major content containers on the dark base.

**Data Tables**
No vertical dividers. Horizontal rules use `border-outline-variant/20`. Alternating row backgrounds use `hover:bg-surface-container/40`. Column headers use `label-caps` style with a bottom border. Numeric columns use IBM Plex Sans with `tnum` feature.

**Score Ring (SVG)**
Animated donut ring used on every MatchCard (`src/components/MatchCard.tsx`).
SVG circle with `stroke-dasharray` equal to full circumference, animated to
the target `stroke-dashoffset` on load (~0.6s ease). Stroke color matches
the score's band (see Score Badges). Background ring `rgba(255,255,255,0.07)`.

**Chips & Sector Tags**
Shared sector chips: `font-label text-[10px] tracking-wider px-2 py-0.5 rounded-full border`.
- Overlapping sectors (user + match): Emerald fill (`bg-tertiary/15 text-tertiary border-tertiary/30`)
- Non-overlapping sectors: Neutral (`bg-surface-container text-on-surface-variant border-outline-variant/30`)

**Toast Notifications**
Fixed bottom-center, auto-dismisses after 4s. Success: `bg-tertiary/15 border-tertiary/40` with check_circle icon. Error: `bg-error-container border-error/40`.

**Modals**
Fixed full-screen overlay with `bg-black/60 backdrop-blur-sm` backdrop. Content panel `max-w-lg`, `bg-surface-container-low`, `rounded-xl`. Header separated by `border-b border-outline-variant/30`. Close button top-right.

## Algorithmic Scoring

The match score is computed in `src/lib/scoring.ts` across 4 weighted dimensions:

| Dimension | Weight | Logic |
|---|---|---|
| Sector overlap | 40% | `matches / max(|A|, |B|)` across each side's sector array |
| Stage overlap | 30% | same formula across stage arrays |
| Check size compatibility | 20% | overlap-of-ranges / span (1.0 when both collapse to the same point) |
| Geography overlap | 10% | same formula across geography arrays |

Score is capped at 99 (never 100 — conveys ongoing discovery). Bands:
**Strong Fit** (80+), **Good Fit** (65–79), **Possible Fit** (50–64),
**Low Fit** (<50). Risk profile is captured in the profile but not yet
folded into the score.

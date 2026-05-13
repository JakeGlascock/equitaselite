# Equitas Elite

> Private investor alignment platform for Angel Investors and Family Offices.

Equitas Elite algorithmically matches Angel Investors with Family Offices based on investment mandate compatibility — sectors, stages, check size, geography, and risk profile — and generates a detailed Strategic Alignment Report for each pairing.

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Login | `index.html` | Authentication with biometric option. Seeds demo data. |
| Onboarding | `onboarding.html` | 4-step registration: role selection, institutional profile, investment mandate, review. |
| Dashboard | `dashboard.html` | Executive overview — top matches, mandate summary, sector alignment map. |
| Discovery | `discovery.html` | Full match discovery with search, filter, and sort. |
| Alignment Report | `alignment.html` | Strategic Alignment Report — animated score ring, radar chart, sector synergies, 5-dimension breakdown. |
| Deal Room | `deal-room.html` | Per-deal workspace with document vault, secure chat, activity stream, and stakeholder grid. |
| Portfolio | `portfolio.html` | Portfolio management — AUM metrics, holdings table, stage donut chart, monthly bar chart. |
| Network | `network.html` | Institutional partners, syndicates, and co-investment network. |
| Notifications | `notifications.html` | Tabbed notification center — Matches, Deal Room, Account. |
| Settings | `settings.html` | Firm profile, team management, security preferences, subscription. |
| Reports | `reports.html` | Report generator — type selection, date range, metric chips, live preview, PDF export. |

---

## Tech Stack

- **Pure HTML/CSS/JS** — no framework, no build step, runs directly in the browser
- **Tailwind CSS** via CDN with inline config per page
- **Material Symbols Outlined** (Google Fonts) for icons
- **Playfair Display / Inter / IBM Plex Sans** for typography
- **localStorage** for persistence — no backend required

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Angel Investor | `demo@angelinvestor.com` | `demo123` |
| Family Office | `demo@familyoffice.com` | `demo123` |

---

## Alignment Scoring

Matches are scored across 5 weighted dimensions (max 99):

| Dimension | Weight |
|-----------|--------|
| Sector overlap | 40% |
| Stage alignment | 30% |
| Check size compatibility | 20% |
| Geography | 10% |

Score labels: **Exceptional** (85+) · **Strong** (70–84) · **Good** (55–69) · **Moderate** (<55)

---

## Project Structure

```
equitaselite/
├── index.html          # Login
├── onboarding.html     # Registration flow
├── dashboard.html      # Main dashboard
├── discovery.html      # Match discovery
├── alignment.html      # Strategic Alignment Report
├── deal-room.html      # Deal workspace
├── portfolio.html      # Portfolio management
├── network.html        # Network & syndicates
├── notifications.html  # Notification center
├── settings.html       # Firm settings
├── reports.html        # Report generator
├── shared.js           # Shared utilities, nav, modals, mock data
├── DESIGN.md           # Design system documentation
└── CNAME               # Custom domain (equitaselite.com)
```

---

## Design System

See [`DESIGN.md`](DESIGN.md) for the full design system — color tokens, typography, spacing, elevation, and component specs.

**Key tokens:**
- Background: `#031427` (Midnight Navy)
- Gold accent: `#e9c176` (CTAs, active states, prestige indicators)
- Emerald accent: `#4edea3` (success, top-tier scores, verified status)
- Primary text: `#d3e4fe`

---

## Local Development

No build step required. Open any HTML file directly in a browser:

```bash
open index.html
```

Or serve locally:

```bash
npx serve .
```

---

## Deployment

Hosted on **GitHub Pages** with a custom domain via GoDaddy DNS.

Live at: **[equitaselite.com](https://equitaselite.com)**

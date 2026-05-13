# PLANNING.md — Equitas Elite

Product roadmap, feature pipeline, and strategic priorities.

---

## Current State

Equitas Elite is a **functional prototype** deployed at equitaselite.com. It demonstrates the core product concept end-to-end: dual-role onboarding, algorithmic match scoring, strategic alignment reporting, and a full suite of investor workflow pages.

### What Exists Today

| Area | Status | Notes |
|------|--------|-------|
| Login / Auth | ✅ Prototype | Demo credentials, localStorage session |
| Onboarding | ✅ Prototype | 4-step registration, role-aware fields |
| Dashboard | ✅ Prototype | Match cards, mandate summary, sector map |
| Discovery / Matches | ✅ Prototype | Search, filter, sort, grid/list view |
| Alignment Report | ✅ Prototype | Score ring, radar chart, 5-dimension breakdown |
| Deal Room | ✅ Prototype | Document vault, chat, activity stream |
| Portfolio | ✅ Prototype | Holdings, charts, distributions |
| Network & Syndicates | ✅ Prototype | Partner table, syndicate cards, requests |
| Notifications | ✅ Prototype | Tabbed center, action buttons |
| Settings | ✅ Prototype | Firm profile, team, security, subscription |
| Reports | ✅ Prototype | Generator with type, range, metrics, preview |
| Brand & Design | ✅ Complete | Full design system, logo, DESIGN.md |
| Documentation | ✅ Complete | README, DESIGN, AGENTS, PROTOCOL, SKILL, ARCHITECTURE |
| Deployment | ✅ Live | GitHub Pages, custom domain, HTTPS |

### What Does Not Exist

- Real authentication (no MFA, no token-based sessions)
- Real database (all data is mock or localStorage)
- Real document storage (vault is mocked)
- Real-time messaging (chat is simulated)
- Real notifications (all mock data)
- Multi-user sessions (one browser = one user)
- Admin / back-office tooling
- Payment / subscription processing
- Mobile apps

---

## Phase 1 — Production Foundation
**Goal:** Make the prototype safe for real users and real data.

### 1.1 Authentication & Identity
- [ ] Migrate to Supabase Auth (email/password + MFA)
- [ ] Institutional email domain verification (whitelist by domain)
- [ ] Invite-only registration with admin approval workflow
- [ ] Session management with refresh tokens and configurable timeout
- [ ] SSO support (Google Workspace, Microsoft Entra) for family office IT teams
- [ ] Audit log for all authentication events

### 1.2 Data Layer
- [ ] Migrate from localStorage to Supabase PostgreSQL
- [ ] `profiles` table with Row Level Security (users see only their own row)
- [ ] `candidates` table for the match pool (managed by admin)
- [ ] `deals` table with participant-based access control
- [ ] `notifications` table with read/unread state
- [ ] `activity_log` table for all deal room actions
- [ ] Automated daily backups

### 1.3 Infrastructure
- [ ] Migrate hosting from GitHub Pages to Vercel
- [ ] Update DNS from GitHub Pages IPs to Vercel
- [ ] Configure environment variables (Supabase keys, etc.)
- [ ] Set up staging environment (staging.equitaselite.com)
- [ ] Error monitoring (Sentry or similar)
- [ ] Uptime monitoring with alerting

### 1.4 Legal & Compliance
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Data Processing Agreement (DPA) for EU/UK users
- [ ] Cookie consent banner (if analytics added)
- [ ] SEC / FCA regulatory review for investment platform classification
- [ ] Penetration test before first external users

---

## Phase 2 — Core Product
**Goal:** Replace all mocked features with real, working functionality.

### 2.1 Real Matching Engine
- [ ] Move scoring algorithm server-side (Supabase Edge Function or Next.js API route)
- [ ] Expand scoring dimensions — deal history, co-investment track record, portfolio overlap
- [ ] Weighted preference sliders in Settings so users can tune their own algorithm
- [ ] Scheduled re-scoring when a user updates their mandate (async job)
- [ ] Match explanations — plain-language summary of why two parties align
- [ ] "Why Not" view — show which dimensions pulled the score down

### 2.2 Real Document Vault
- [ ] Supabase Storage with signed URLs (no public file access)
- [ ] Per-deal access control (only deal participants can view documents)
- [ ] Version history for uploaded files
- [ ] Virus scanning on upload
- [ ] Watermarking for sensitive financial documents
- [ ] Document request workflow (investor requests a document, founder uploads)

### 2.3 Real Messaging
- [ ] Supabase Realtime for live chat in Deal Room
- [ ] End-to-end encrypted messaging option for NDA-protected communications
- [ ] Message read receipts
- [ ] File attachments in chat
- [ ] Email notification for new messages (configurable digest)

### 2.4 Real Notifications
- [ ] Push notifications (web push API)
- [ ] Email digest (daily or weekly, configurable)
- [ ] In-app notification feed driven by real events (new match, deal update, message)
- [ ] Notification preferences per category

### 2.5 Real Deal Room
- [ ] Deal creation with structured term sheet fields
- [ ] Multi-party commitment tracking (who has committed, at what amount)
- [ ] Funding progress calculated from real commitments
- [ ] eSign integration for term sheets (DocuSign or similar)
- [ ] Deal timeline with milestone tracking
- [ ] Closing workflow with wire transfer coordination checklist

### 2.6 Real Portfolio
- [ ] Manual portfolio entry (investment amount, date, valuation)
- [ ] Integration with cap table management tools (Carta, Pulley)
- [ ] IRR and MOIC calculations from real entry/exit data
- [ ] Quarterly reporting automation
- [ ] Portfolio export to Excel / PDF

---

## Phase 3 — Network Effects
**Goal:** Build the features that make the platform more valuable as more investors join.

### 3.1 Verified Network
- [ ] Identity verification for institutional members (KYC/AML via Persona or similar)
- [ ] Accredited investor verification (US) / professional investor classification (EU/UK)
- [ ] Firm verification — confirm AUM, regulatory status, legal entity
- [ ] Verified badge displayed on profile and in match cards
- [ ] Tiered membership (Standard / Verified / Premier)

### 3.2 Syndicate Platform
- [ ] Create and manage syndicates with defined carry and fee structures
- [ ] Syndicate invitation and acceptance workflow
- [ ] SPV (Special Purpose Vehicle) document generation
- [ ] Co-investment commitment aggregation
- [ ] Syndicate performance dashboard
- [ ] Pro-rata rights tracking

### 3.3 Deal Flow Sourcing
- [ ] Company / founder profiles (a third user type alongside Angel and Family Office)
- [ ] Founders can create fundraising profiles and be matched to investors
- [ ] Curated deal flow from Equitas Elite editorial team
- [ ] Deal room initiated by founders, investors invited by score threshold
- [ ] Warm introductions — mutual connection-based intros for high-score matches

### 3.4 Intelligence Layer
- [ ] Market comparables for deal terms (based on anonymized closed deals)
- [ ] Sector trend reports generated from aggregated portfolio data
- [ ] Co-investor graph — who has invested alongside whom
- [ ] Follow-on signal — flag when a portfolio company raises a new round
- [ ] LP reporting templates auto-populated from portfolio data

---

## Phase 4 — Scale & Monetization
**Goal:** Build the business model and scale to institutional adoption.

### 4.1 Subscription Tiers

| Tier | Target | Price (est.) | Features |
|------|--------|--------------|----------|
| **Observer** | Free | $0 | View-only access, 3 match profiles, no Deal Room |
| **Member** | Individual angels | $500/mo | Full matching, Deal Room, 2 syndicates |
| **Institutional** | Family offices, VCs | $2,500/mo | Unlimited matching, document vault, portfolio, reports |
| **Premier** | Large family offices, funds | $10,000/mo | White-glove onboarding, custom scoring, API access, dedicated CSM |

### 4.2 Transaction Revenue
- [ ] Success fee on closed deals introduced through the platform (0.5–1%)
- [ ] Syndicate management fee processing (platform takes carry on carried interest)
- [ ] SPV formation fee

### 4.3 Admin & Back-Office
- [ ] Admin dashboard for Equitas Elite team
- [ ] Manual user approval / rejection workflow
- [ ] Platform-wide analytics (match rates, deal closure rates, AUM tracked)
- [ ] Subscription management and billing (Stripe)
- [ ] Support ticket system

### 4.4 API & Integrations
- [ ] REST API for Premier tier members to integrate match data into their own systems
- [ ] Webhook support for deal room events
- [ ] Integration with Salesforce / HubSpot for family office CRM users
- [ ] Bloomberg / Refinitiv data feed for market context on deal terms
- [ ] Slack integration for deal room notifications

---

## Phase 5 — Mobile
**Goal:** Native mobile experience for on-the-go access.

- [ ] React Native app (iOS + Android) sharing business logic with the web app
- [ ] Biometric authentication (Face ID, Touch ID) — native, not web
- [ ] Push notifications via APNs / FCM
- [ ] Offline mode for reading deal documents on flights
- [ ] Portfolio widget for iOS home screen

---

## Immediate Next Steps (Now → 30 Days)

These are the actions that move the project from prototype to production-ready:

1. **Scaffold Next.js project** in `/nextjs` directory — preserve all visual design
2. **Set up Supabase project** — create `profiles`, `deals`, `notifications` tables with RLS
3. **Migrate authentication** — replace demo login with Supabase Auth + MFA
4. **Port Dashboard and Discovery pages** — first two pages on real data
5. **Legal review** — engage counsel to assess regulatory classification
6. **Recruit beta users** — 5–10 real angel investors and family offices for closed beta
7. **Set up staging environment** — staging.equitaselite.com on Vercel

---

## Open Questions

- **Regulatory classification** — Does the platform constitute investment advice or act as a broker-dealer under US law? This determines licensing requirements before real money flows through the platform.
- **Data residency** — Do European family office users require data stored in EU regions? (Supabase supports EU regions — needs to be configured from the start.)
- **Founder profiles** — Is Phase 3 deal flow sourcing in scope, or does the platform remain investor-to-investor only?
- **Carry structure** — What is the platform's take on syndicate carry? Needs to be defined before the syndicate feature is built.
- **Mobile priority** — Does the institutional target audience expect a native app, or is the mobile web experience sufficient?

# PROTOCOL.md — Equitas Elite

Operational protocols for development, deployment, design, and security.

---

## Development Protocol

### Local Setup

No install required. Open any page directly in a browser:

```bash
open index.html
```

Or serve locally to avoid file:// path issues with relative imports:

```bash
npx serve .
# → http://localhost:3000
```

### Workflow

1. Make changes to the relevant file(s)
2. Open `index.html` in the browser and test the full user flow (login → onboarding → affected page)
3. Check mobile layout by resizing the browser to < 768px
4. Commit and push — GitHub Pages auto-deploys within ~60 seconds

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Angel Investor | `demo@angelinvestor.com` | `demo123` |
| Family Office | `demo@familyoffice.com` | `demo123` |

Always test both roles when changing anything in `shared.js`, `dashboard.html`, `discovery.html`, or `alignment.html` — several views are role-dependent.

### Before Every Commit

- [ ] Tested in Chrome (primary) and Safari
- [ ] Tested at mobile width (375px)
- [ ] No `alert()` or `console.log()` left in code
- [ ] No hardcoded hex values outside the design token set
- [ ] `shared.js` functions not duplicated in page files
- [ ] Logo and nav render correctly on at least one authenticated page

---

## Git Protocol

### Branch Strategy

`master` is the production branch — it deploys directly to equitaselite.com via GitHub Pages. All commits go to `master` for now. When the team grows, introduce a `dev` branch and use PRs.

### Commit Messages

Use the imperative mood, present tense. Lead with the scope:

```
Add [feature]
Fix [bug]
Update [component/page]
Remove [thing]
Refactor [area]
```

Examples:
```
Add deal room document upload flow
Fix alignment score bar animation on Safari
Update sidebar to include Reports link
Remove duplicate matchScore function from dashboard
```

### Pushing to Production

```bash
git add <files>
git commit -m "Your message"
git push
```

GitHub Pages deploys automatically. Allow ~60 seconds, then hard-refresh equitaselite.com (`Cmd+Shift+R`).

---

## Deployment Protocol

### Stack

| Layer | Service |
|-------|---------|
| Hosting | GitHub Pages |
| Domain | GoDaddy → equitaselite.com |
| CDN / HTTPS | GitHub Pages (Let's Encrypt auto-renewal) |
| Repository | github.com/JakeGlascock/equitaselite |

### DNS Records (GoDaddy)

| Type | Name | Value |
|------|------|-------|
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |
| CNAME | www | `jakeglascock.github.io` |

Do not modify these records without understanding the impact — removing the A records will take the site offline.

### HTTPS Troubleshooting

If HTTPS breaks:
1. Check GitHub Pages settings — custom domain should show `equitaselite.com` with a green checkmark
2. Run `dig equitaselite.com +short` — must return all four GitHub IPs above
3. If DNS check is in progress, wait 30 minutes before taking further action
4. If cert fails, remove and re-add the custom domain in GitHub Pages settings to trigger re-provisioning

---

## Design Protocol

The design system is documented in `DESIGN.md`. All UI work must follow it. The key rules:

### Color

Never introduce a new hex value. Every color must map to a design token:

| Intent | Token | Value |
|--------|-------|-------|
| Page background | `bg-background` | `#031427` |
| Primary CTA | `bg-secondary` | `#e9c176` |
| Success / top score | `text-tertiary` | `#4edea3` |
| Body text | `text-on-surface` | `#d3e4fe` |
| Muted text | `text-on-surface-variant` | `#c6c6cd` |
| Card border | `border-outline-variant` | `#45464d` |

### Typography

| Use | Class |
|-----|-------|
| Page / section titles | `font-display` (Playfair Display) |
| Body copy, metrics | `font-body` (Inter) |
| Labels, chips, table headers | `font-label` (IBM Plex Sans) |
| Section headers | `font-label text-[10px] tracking-widest uppercase text-on-surface-variant` |

### Adding a New Component

1. Check `DESIGN.md` — the component may already be specified
2. Match the visual language of the nearest existing component
3. Use `glass-panel` for all content cards
4. Use `eeShowToast()` for feedback — never `alert()`
5. Ensure 44px minimum touch target on all interactive elements

---

## Data Protocol

### localStorage Schema

| Key | Shape | Owner |
|-----|-------|-------|
| `ee_current_user` | `UserProfile` object | Set on login/onboarding, read by all pages |
| `ee_users` | `UserProfile[]` | Written by onboarding, read by login |
| `ee_selected_candidate` | `UserProfile` object | Written by dashboard/discovery, read by alignment.html |

### UserProfile Shape

```js
{
  type: 'angel' | 'family_office',
  name: string,
  firm: string,
  title: string,
  location: string,
  aum: string,           // e.g. "$450M"
  minCheck: number,      // in $M
  maxCheck: number,      // in $M
  stages: string[],
  sectors: string[],
  geography: string,
  riskTolerance: string,
  // Angel only:
  expectedReturn: string,
  timeline: string,
  // Family Office only:
  mandate: string,
  concentration: string,
}
```

### Clearing State

To reset all app data (simulate a fresh user):
```js
localStorage.clear()
```

Or in the browser console. The login page also provides a "Sign Out" flow that clears `ee_current_user`.

---

## Security Protocol

### Current State (Prototype)

The current application is a **client-side prototype**. All data lives in `localStorage` — there is no server, no real authentication, and no encrypted storage. It is suitable for demonstration purposes only.

**Do not store real investor data, real deal terms, or real financial information in this version.**

### Production Readiness Requirements

Before onboarding real users, the following must be in place:

1. **Real authentication** — Replace demo credentials with a proper auth provider (Supabase Auth, Auth0, or similar) supporting MFA
2. **Server-side data** — Move all user profiles and deal data from `localStorage` to a PostgreSQL database with row-level security
3. **Encrypted document storage** — Replace the mocked document vault with signed-URL file storage (Supabase Storage or AWS S3)
4. **API security** — The matching algorithm must run server-side so scoring logic and user data are never exposed in client JS
5. **Audit logging** — All deal room access and document views must be logged
6. **Privacy policy & terms** — Required before collecting any real user data
7. **Penetration testing** — Before launch to institutional investors

### Recommended Production Stack

See `README.md` for the recommended migration path to **Next.js + Supabase**.

---

## Agent Protocol

AI agents working on this codebase must follow `AGENTS.md` in full. Key points:

- Always use `eeBootstrap('page.html')` — never inline nav HTML
- Never duplicate mock data or scoring functions from `shared.js`
- Never introduce new colors outside the token set
- Never use `alert()` — use `eeShowToast()`
- Test both user roles after any change to shared logic
- Commit with a clear imperative message after each logical change

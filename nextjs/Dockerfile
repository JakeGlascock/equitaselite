FROM node:24-slim AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ---- builder ----
# NODE_ENV intentionally not set to production here — npm install skips
# devDependencies when NODE_ENV=production, but tailwindcss/postcss/typescript
# are devDeps required for next build to succeed.
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm install
# CACHE_BUST is wired to the commit SHA from the deploy workflow so the
# layer cache from this point on invalidates on every commit. Without
# this, BuildKit's GHA cache backend has been observed to serve stale
# layers for `COPY . .` even when source changed — yielding deploys that
# succeeded at the workflow level but ran the previous build artifact
# (see the 2026-05-29 woff2 + next/image stale-deploy incident).
# Deps install above is unaffected and still caches cleanly across builds.
ARG CACHE_BUST=changeme
RUN echo "Cache bust: ${CACHE_BUST}"
COPY . .
RUN npm run build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production

# Apply latest OS security patches (addresses OS-level CVEs in zlib, ncurses, etc.)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Non-root user for defense-in-depth
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration runner: scripts/migrate.mjs reads db/migrations/*.sql at runtime.
# Standalone trace doesn't include these paths, so copy them explicitly.
# The runner reuses `pg` from standalone node_modules (already traced via @/lib/db).
COPY --from=builder --chown=nextjs:nodejs /app/scripts            ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations      ./db/migrations

# Pitch deck HTML rendered from pitch.md by Marp — served by the
# /deck/[token] route handler. NOT in /public/ on purpose: the deck
# is only reachable through a token-validated route.
COPY --from=builder --chown=nextjs:nodejs /app/decks               ./decks

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

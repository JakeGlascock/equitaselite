FROM node:22-slim AS base
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
COPY . .
RUN npm run build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production

# Apply latest OS security patches (addresses OS-level CVEs in zlib, ncurses, etc.)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Enable Node.js FIPS mode at runtime only — npm install during build does not
# need FIPS and CI runners may not have the FIPS provider configured.
# FIPS 140-2/3: delegates all crypto to OpenSSL's FIPS provider (OpenSSL 3, node:22-slim).
ENV NODE_OPTIONS="--openssl-fips"

# Non-root user for defense-in-depth
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

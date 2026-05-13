FROM node:22-slim AS base
WORKDIR /app

# Enable Node.js FIPS mode — required for FIPS 140-2/3 boundary compliance.
# Delegates all crypto to OpenSSL's FIPS provider (built into node:22-slim via OpenSSL 3).
ENV NODE_OPTIONS="--openssl-fips"
ENV NODE_ENV=production

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- builder ----
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runner ----
FROM base AS runner
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

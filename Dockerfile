# syntax=docker/dockerfile:1

# ── base ──────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app

# Fix production environment
ENV NODE_ENV=production

EXPOSE 3000

# Runtime secrets/config — must be supplied at container start, never baked in
# DATABASE_URL and NUXT_SESSION_PASSWORD are required at runtime

# Copy only the Nitro server output from the build stage
COPY --from=build /app/.output .

# Run as non-root user (node user is provided by the official Node image)
USER node

ENTRYPOINT ["node", "server/index.mjs"]

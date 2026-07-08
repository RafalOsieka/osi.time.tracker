# syntax=docker/dockerfile:1

# ── base ──────────────────────────────────────────────────────────────────────
FROM node:25-alpine AS base
RUN npm install -g pnpm@latest

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Skip postinstall (nuxt prepare) here — source isn't copied yet, so it would
# run against an empty workspace and produce incomplete type stubs.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source, then generate Nuxt types and build
COPY . .
RUN pnpm exec nuxt prepare && pnpm build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:25-alpine AS runtime
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

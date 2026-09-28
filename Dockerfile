# syntax=docker/dockerfile:1

# ── build ─────────────────────────────────────────────────────────────────────
# The official Vite+ image ships the `vp` CLI and resolves Node.js and pnpm from
# `devEngines` in package.json. Keep the tag in sync with the `vite-plus` catalog
# entry in pnpm-workspace.yaml.
FROM ghcr.io/voidzero-dev/vite-plus:1.0.0 AS build
WORKDIR /app

# Copy package manifests first for better layer caching. The image runs as the
# non-root `vp` user, so copied files must be owned by it. Only the web app and
# its workspace dependencies are installed; the filter keeps the frozen install
# from requiring the manifests of the other workspace projects.
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=vp:vp packages/remote-trackers/package.json packages/remote-trackers/
COPY --chown=vp:vp packages/extension-protocol/package.json packages/extension-protocol/
COPY --chown=vp:vp apps/web/package.json apps/web/

# Skip postinstall (nuxt prepare) here — source isn't copied yet, so it would
# run against an empty workspace and produce incomplete type stubs.
RUN vp install --frozen-lockfile --ignore-scripts --filter "@osi/time-tracker..."

# Copy source (the build context is an allowlist — see .dockerignore), then
# build the workspace libraries, generate Nuxt types and build the app
COPY --chown=vp:vp . .
RUN vp run build:packages \
  && vp exec --filter @osi/time-tracker nuxt prepare \
  && vp run --filter @osi/time-tracker build

# ── runtime ───────────────────────────────────────────────────────────────────
# The Nitro output is self-contained (no native modules), so a slim Node image
# on the same major as `devEngines.runtime` is enough.
FROM node:24-alpine AS runtime
WORKDIR /app

# Fix production environment
ENV NODE_ENV=production

EXPOSE 3000

# Runtime secrets/config — must be supplied at container start, never baked in
# DATABASE_URL and NUXT_SESSION_PASSWORD are required at runtime

# Copy only the Nitro server output from the build stage
COPY --from=build /app/apps/web/.output .

# Run as non-root user (node user is provided by the official Node image)
USER node

ENTRYPOINT ["node", "server/index.mjs"]

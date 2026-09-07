## Why

The web app and planned Chromium extension need the same tracker implementations without sharing Nuxt's compilation context. Establishing independently built workspace packages first separates a behavior-preserving migration from the new execution mode.

## What Changes

- Move the Nuxt application, app-specific configuration, and tests into `apps/web`.
- Extract `@osi/remote-trackers` into `packages/remote-trackers`: provider implementations, neutral contracts, errors, and their required utilities, with standalone builds, tests, and explicit exports.
- Use private `pnpm` workspace packages and `workspace:*` dependencies, emitting JavaScript and declarations.
- Preserve root developer commands while updating Docker, CI, test harnesses, coverage, lint, and documentation for workspace paths.
- Keep repository-wide tooling, OpenSpec, Compose files, and the lockfile at the root.
- **BREAKING** for source-path consumers: web sources and build output relocate; internal deep imports become package imports. User-facing APIs and persisted data remain unchanged.

## Capabilities

### New Capabilities

- `workspace-packages`: independently consumable tracker package and reproducible workspace commands/builds.

### Modified Capabilities

- `remote-adapter-contract`: neutral DTO ownership moves from Nuxt `shared/types` to the framework-independent tracker package; the seven operations remain unchanged.

## Non-goals

No extension scaffold, extension protocol, new execution mode, provider behavior redesign, database migration, public package publishing, Nx, or Turborepo. Do not upgrade the platform as part of the move.

## Impact

Touches root manifests/configuration, web source imports, provider tests, Docker build stages, migration command paths, CI artifacts, and developer documentation. Existing client/server functionality and credential handling must remain equivalent. This is enabling infrastructure for the user's requested MVP remote-connectivity improvement (WBS 5.1–5.3, 5.14–5.15), not a new domain feature. Some older user stories still describe client-only execution; current implementation and active adapter specs already support both modes and take precedence.
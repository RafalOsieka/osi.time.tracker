## Context

See `proposal.md` for motivation. The root currently hosts Nuxt, its generated TypeScript references, Vitest's web and tooling suites, and all dependencies. `pnpm-workspace.yaml` contains build policy but no package globs. Provider code uses relative imports, but the adapter contract imports `RemoteTimeLogDto` from a file also containing local finalization and Nitro proxy schemas. OpenProject authentication has a `Buffer` fallback. Docker installs root manifests before copying source; the standalone migrator runs a root script in the build image.

## Goals / Non-Goals

**Goals:** enforce a framework-independent public package boundary, preserve runtime behavior, and make clean builds reliable without hidden generated files.

**Non-Goals:** see proposal. In particular, do not invent extension message types here or change credential ownership.

## Decisions

### Workspace layout and ownership

Use plain pnpm workspaces, private `@osi/web` and `@osi/remote-trackers` packages, and one root lockfile. No orchestration framework is needed for this dependency graph.

```text
apps/web/                 Nuxt app, server, shared, i18n, public, app tests
packages/remote-trackers/ Neutral contracts, providers, provider tests
tools/                    Existing repository tooling, unchanged
test/unit/anti-slop/      Existing tooling tests, retained at root
openspec/                 Repository-wide behavioral source of truth
```

Move Nuxt, Drizzle, web TypeScript, and web test configuration into `apps/web`. Keep root command orchestration, formatting, Compose files, Dockerfile, CI, docs, and tooling policy at the root. Root ESLint can delegate web-specific generated Nuxt configuration; update paths without changing rules. Do not modify the vendored anti-slop plugin.

Alternative: keep Nuxt at the root. Valid, but it leaves application configuration and workspace orchestration mixed and is not the agreed target.

### Narrow tracker package

Extract both provider directories plus their transitive neutral types and utilities. Split `RemoteTimeLogDto` from `shared/types/remote-export.ts`; finalization, export outcomes, proxy request schemas, database entities, tracker forms, and user configuration stay web-owned. Split neutral issue/account/option shapes from app-specific persistence shapes where needed. Shared DTOs have one definition, not copies in both locations.

Expose contracts and providers through explicit package subpaths (for example `@osi/remote-trackers/contracts`, `/openproject`, `/redmine`) so type-only consumers do not pull provider implementations. Use `workspace:*`, not Nuxt aliases or source deep imports. Browser and server transports remain in the web app. The later extension will supply its own transport.

Alternative: a generic common package or direct imports from web `shared`. Both weaken ownership and allow accidental framework dependencies.

### Independent emitted artifacts

Use standalone TypeScript compilation to `dist` with ESM JavaScript and declarations, explicit package exports, and declared runtime `zod` dependency. Package TypeScript includes standard ECMAScript/Web API types but no Nuxt or Node ambient types; provider test configuration may use Node separately. Emitted imports must resolve in Node as well as bundlers. Preserve the existing supported runtime baseline rather than bundling a platform upgrade.

Replace the Node-only auth fallback with a standards-based encoding path compatible with supported runtimes; retain existing valid API-key header bytes and test them in a browser-like runtime without `Buffer`. Do not expand accepted credential semantics as part of extraction.

Alternative: expose source-only TypeScript. Easier watching, but consumer-specific transpilation can hide missing dependencies and does not provide the requested independent artifact boundary.

### Commands, tests, and environment

Root `build` and `type-check` run dependencies first and fail immediately on errors. `dev` first builds the tracker package, then runs its watch build alongside Nuxt with shared lifecycle cleanup. Nuxt preparation belongs to the web package; a filtered package install/build must not invoke it. Root test commands preserve their current meanings while including provider and anti-slop unit tests. Package tests use their own plain Vitest configuration without importing `@nuxt/test-utils`.

Keep the developer `.env` location at the repository root to preserve Compose interpolation and existing local configuration. Wire root web commands and Drizzle explicitly to that location; production continues receiving environment variables normally. Never move an existing secret file or duplicate secrets into packages. Update generated-output ignores and lint exclusions for nested `.nuxt`, `.output`, and `dist` paths.

### Deployment and CI

Keep Docker's build context at the workspace root. Copy required workspace manifests before frozen installation, then source, build the package, prepare/build the web app, and copy `apps/web/.output` into the existing minimal runtime layout. Keep the build target usable by `pnpm db:migrate`; the root forwarding command resolves the relocated migrator and SQL files. Do not alter migration SQL or database volume names.

Update CI upload/download paths, E2E build reuse, coverage source paths and aggregation, and test harness root resolution. Preserve all existing gates, test isolation, and fail-in-CI behavior for unavailable prerequisites. Use a filtered, no-Nuxt preparation job/check for the independent package guarantee, not merely a successful full workspace build.

## Risks / Trade-offs

- Path-sensitive E2E/coverage configuration can silently omit files -> compare discovered tests and coverage inputs before and after, including tooling tests.
- Emitted artifacts can become stale -> ordered root commands and package watch mode; clean CI builds prove resolution.
- Node types may leak through dependencies -> explicit package ambient types and an independent build without `.nuxt`.
- Existing docs disagree on Node minimum and old client-only scope -> retain current runtime versions and active client/server contracts; document the discrepancy without broad unrelated edits.
- Deployment validation could touch daily-driver data -> build/test only with isolated temporary Compose projects and fresh volumes, never an existing deployment.

## Migration Plan

1. Establish package compilation and move the neutral core with its tests.
2. Move the web application and rewire consumers and root workflows.
3. Update Docker, CI, environment resolution, and developer documentation.
4. Run package isolation checks and the existing web gates against isolated test resources; verify a production image and migrator without live data.

No schema or data transformation is required. Rollback is deployment of the prior image; repository rollback is a normal reviewed inverse change, not deletion of user files. Land and validate this migration before applying `add-browser-extension-execution`.
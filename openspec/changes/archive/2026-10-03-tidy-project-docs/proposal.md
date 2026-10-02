# Proposal

## Why

The repository documentation still describes an early MVP: the README lists PrimeVue, a `Client → Project → Task` hierarchy, server-proxied adapters and a "deferred" Redmine adapter, and `docs/` holds planning files (`vision.md`, `wbs.md`, `user-stories.md`) whose content now lives in OpenSpec. README and `AGENTS.md` duplicate the same commands and have already drifted apart. Self-hosting instructions are buried between developer-only sections.

## What Changes

- Remove `docs/vision.md`, `docs/wbs.md`, `docs/user-stories.md` and `docs/github-setup.md`.
- Add `ROADMAP.md`: only the features that are actually planned (no priorities, no non-goals).
- Add `docs/self-hosting.md`: production compose stack, secrets, upgrade notes, logs, VPN reachability, browser extension.
- Add `docs/development.md`: local environment setup for a human (prerequisites, `.env`, database, dev server, local OpenProject/Redmine with `pnpm trackers:seed` and the fixture contents, local extension build).
- Move `CODING_STANDARDS.md` to `docs/coding-standards.md` and refresh stale content.
- Rewrite `README.md` from scratch (via the `create-readme` skill): short, current product overview with links.
- Rewrite `AGENTS.md` from scratch (via the `create-agentsmd` skill): only what an agent needs to work on code; no environment setup.
- Restructure `docs/e2e-guideline.md` and bring it up to date.
- Update `openspec/config.yaml` rules that point at the removed planning files or assume an MVP scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-dev-trackers`: REQ-082 moves the local tracker instructions from `AGENTS.md` and README into `docs/development.md`.
- `platform-type-safety`: REQ-243 points at `docs/coding-standards.md` instead of `CODING_STANDARDS.md`.
- `platform-ci`: REQ-023 is replaced by REQ-406 with the same merge-blocking ruleset, minus the committed manual GitHub-UI setup guide.

## Non-goals

- User documentation for the app (in-app help or a docs site); it is listed in the roadmap.
- Versioning, tags or a changelog.
- Any change to application code, CI workflows, compose files or the anti-slop plugin.
- Moving the backlog to GitHub Issues.
- Fixing the `useUserSettings` reference in the coding standards that the `user-profile-page` branch made stale; that fix belongs to that branch. The move here keeps whatever text is current at implementation time.

## Impact

- Root and `docs/` Markdown files, `openspec/config.yaml`, three main specs via deltas.
- No runtime, API, database or dependency changes.
- Agents reading `AGENTS.md` lose the environment-setup commands; humans find them in `docs/development.md`.

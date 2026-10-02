# Tasks

Docs-only change: there is no frontend or backend code, so verification is by reading, link checks and `pnpm format:check`.

## 1. Remove obsolete planning and setup docs

- [ ] 1.1 Delete `docs/vision.md`, `docs/wbs.md`, `docs/user-stories.md` and `docs/github-setup.md`; verify `docs/` no longer contains them
- [ ] 1.2 Update `openspec/config.yaml`: the proposal rule checks `ROADMAP.md` and existing specs instead of the deleted files, and the spec rule scopes requirements to the proposal instead of "MVP unless 🟡"; verify `openspec validate tidy-project-docs` still passes

## 2. New owning documents

- [ ] 2.1 Write `ROADMAP.md` with exactly the design's roadmap sections (no priorities, IDs or non-goals); verify it lists no feature that already exists in `openspec/specs`
- [ ] 2.2 Write `docs/self-hosting.md` from the README Deployment content (prod compose, secrets, ports, upgrade notes, log troubleshooting, VPN reachability, browser extension install and options); verify every command and variable matches `docker-compose.prod.yml` and `.env.example`
- [ ] 2.3 Write `docs/development.md` (prerequisites, `.env`, database and migrations, dev server, local OpenProject/Redmine via the `trackers` profile, `pnpm trackers:seed` with `--dry-run`/`--reset`, dev API keys and their headers, fixture contents and how to try import, local extension build); verify it satisfies REQ-082 in the `platform-dev-trackers` delta and the commands match `package.json` scripts
- [ ] 2.4 Move `CODING_STANDARDS.md` to `docs/coding-standards.md` with `git mv` and refresh stale statements (tech names, removed concepts, paths); verify it still documents everything REQ-243 in the `platform-type-safety` delta requires

## 3. Rewrite README and AGENTS

- [ ] 3.1 Rewrite `README.md` from scratch using the `create-readme` skill, fed the design's ownership map: current product overview and features (Tracker → Project → Task, OpenProject and Redmine, direct browser access or extension), tech stack with Nuxt UI, minimal quick start, links to `ROADMAP.md`, `docs/self-hosting.md`, `docs/development.md`, `docs/coding-standards.md`, `docs/e2e-guideline.md`, `openspec/`; verify no "MVP" status, PrimeVue, Client entity or local tracker setup remains
- [ ] 3.2 Rewrite `AGENTS.md` from scratch using the `create-agentsmd` skill: commands agents run (lint, format, type-check, tests, `db:generate`), Vite+ notes, short high-frequency rule list linking `docs/coding-standards.md`, domain glossary and hard constraints (secrets never reach the server, remote calls on demand), project structure, testing layout, anti-slop and PR rules; verify it contains no environment setup (Docker bring-up, `.env` copy, trackers profile, seed) and links `docs/development.md` instead

## 4. Restructure the e2e guideline

- [ ] 4.1 Reorganize `docs/e2e-guideline.md` into overview, running locally vs CI, conventions, coverage, troubleshooting (symptom / cause / fix) and known gaps; verify every referenced file, script and spec name exists in the repo (e.g. `shared-chunk-warmup.ts`, `remote-proxy-removed.spec.ts`, `timer-view-ui.spec.ts`)

## 5. Integration checks

- [ ] 5.1 Search the repo (excluding `node_modules`, `.nuxt` and `openspec/changes/archive`) for `CODING_STANDARDS.md`, `vision.md`, `wbs.md`, `user-stories.md`, `github-setup.md` and fix remaining references; verify the search returns nothing
- [ ] 5.2 Run `pnpm format:check` and `openspec validate tidy-project-docs`; verify both pass

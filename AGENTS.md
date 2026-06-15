<!-- FOR AI AGENTS - Human readability is a side effect, not a goal -->
<!-- Managed by agent: keep sections concise; document only what exists. Mark not-yet-built items as Planned. -->
<!-- Last verified: 2026-06-15 against package.json, nuxt.config.ts, app/, docs/, openspec/ -->

# AGENTS.md

**OSI Time Tracker** (`osi.time.tracker`) is a self-hosted, open-source personal time tracking web application for IT specialists working across multiple clients and projects. It supports a structured Client → Project → Task hierarchy, a live timer and manual time entry, and on-demand push of time entries to external issue trackers (Redmine, OpenProject) via a dual-mode adapter model.

> **Status:** Early scaffolding. The repo is a fresh Nuxt 4 + PrimeVue starter. Most domain features below are **planned** (see `docs/wbs.md`), not yet implemented. Document only what exists; mark future work as Planned.

## Commands
> Package manager: **pnpm** (`^11.6.0`, see `devEngines` in `package.json`). Source: `package.json` scripts.

| Task | Command | Notes |
|------|---------|-------|
| Install deps | `pnpm install` | runs `nuxt prepare` via `postinstall` |
| Dev server | `pnpm dev` | serves on `http://localhost:3000` |
| Build | `pnpm build` | `nuxt build` |
| Static generate | `pnpm generate` | `nuxt generate` |
| Preview prod build | `pnpm preview` | `nuxt preview` |

> No lint, typecheck, or test scripts are configured yet. Do not claim tests pass — there is no test runner. Add tooling (and document it here) before relying on it.

## Technology

| Component     | Technology                              | State     |
| ------------- | --------------------------------------- | --------- |
| Frontend / API| Nuxt 4, Vue 3, TypeScript               | present   |
| UI Library    | PrimeVue 4 (`@primevue/nuxt-module`, Aura preset) | present   |
| Database      | PostgreSQL                              | planned   |
| Deployment    | Docker / Docker Compose                 | planned   |
| Styling       | Tailwind CSS (optional)                 | planned   |
| PWA           | Nuxt PWA module (service worker, offline cache) | planned   |

> "present" = installed/configured in `package.json` + `nuxt.config.ts`. "planned" = target architecture from `docs/vision.md`, not yet added.

## Architecture (target)

- **Frontend / Backend:** Nuxt 4 — server routes serve as the API layer; no separate backend service in MVP.
- **Database:** PostgreSQL — all user data is stored server-side; each user's data is strictly isolated.
- **Adapter model:** Remote integrations are adapters (one per system type). Each adapter runs in **backend-side** mode (server-to-server, public systems) or **client-side** mode (browser-to-remote, VPN-protected systems). The interface is identical in both modes.
- **PWA:** Nuxt PWA module provides a service worker and offline cache; timer state persisted locally.
- **Deployment:** Docker Compose — full stack (app + database) started with `docker compose up`.

## Domain

Core hierarchy: **User → Client → Project → Task → TimeEntry**

| Term                   | Meaning                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Client**             | A company or person the user works for; top-level grouping for projects; holds `RemoteSystemConfig`.           |
| **RemoteSystemConfig** | Config for a remote issue tracker on a Client: system type, base URL, API credentials, adapter mode, rounding. |
| **Task**               | Unit of work inside a Project; may hold a `RemoteIssueRef` linking it to a remote issue.                       |
| **RemoteIssueRef**     | Lightweight link on a Task: stores only the remote issue ID and cached metadata (title, URL).                  |
| **TimeEntry**          | A logged time interval (start + end or duration) attached to a Task; can be pushed to a remote system.         |
| **Adapter**            | Plugin implementing integration with one remote system (Redmine, OpenProject, …); follows a stable interface.  |
| **Rounding Rule**      | Configurable rule applied to a TimeEntry duration before pushing (e.g. round up to nearest 15 minutes).        |

## Key Constraints

| Constraint    | Detail                                                              |
| ------------- | ------------------------------------------------------------------- |
| Security      | OWASP Top 10, rate limiting, CSP headers                            |
| Feature scope | 🔴 MVP · 🟡 V1.1 · 🟢 Backlog · ⚫ Out of scope – see `docs/wbs.md` |

## Repository Structure

| Path                   | Contents                                              | State   |
| ---------------------- | ----------------------------------------------------- | ------- |
| `app/`                 | Nuxt app source (`app.vue` entry)                     | present |
| `nuxt.config.ts`       | Nuxt + PrimeVue configuration                         | present |
| `public/`              | Static assets served as-is                            | present |
| `docs/vision.md`       | System overview, domain model, roles, lifecycle, NFRs | present |
| `docs/wbs.md`          | Feature list with priorities                          | present |
| `openspec/config.yaml` | OpenSpec workflow rules                               | present |
| `openspec/specs/`      | Behavioral specs – source of truth for implementation | planned |
| `openspec/changes/`    | Active and archived change proposals                  | planned |

> OpenSpec project context lives in this file; `openspec/config.yaml` holds only workflow rules (spec/proposal/design/tasks/verify).

## Current Phase

- [x] Technical business specification + OpenSpec initialization.
- [x] Nuxt 4 + PrimeVue scaffolding.
- [ ] MVP.

## Language

All text files (documentation, diagrams, ADRs, specs) must be in English.

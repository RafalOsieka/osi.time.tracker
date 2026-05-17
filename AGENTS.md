# AGENTS.md

**OSI Time Tracker** (`osi.time.tracker`) is a self-hosted, open-source personal time tracking web application for IT specialists working across multiple clients and projects. It supports a structured Client → Project → Task hierarchy, a live timer and manual time entry, and on-demand push of time entries to external issue trackers (Redmine, OpenProject) via a dual-mode adapter model.

## Architecture

- **Frontend / Backend:** Nuxt 3 (Vue 3, TypeScript) — server routes serve as the API layer; no separate backend service in MVP.
- **Database:** PostgreSQL — all user data is stored server-side; each user's data is strictly isolated.
- **Adapter model:** Remote integrations are implemented as adapters (one per system type). Each adapter can run in **backend-side** mode (server-to-server, for public systems) or **client-side** mode (browser-to-remote, for VPN-protected systems). The adapter interface is identical in both modes.
- **PWA:** Nuxt PWA module provides a service worker and offline cache; timer state is persisted locally.
- **Deployment:** Docker Compose — the full stack (app + database) is started with `docker compose up`.

## Technology

| Component     | Technology                                      |
| ------------- | ----------------------------------------------- |
| Frontend      | Nuxt 3, Vue 3, TypeScript                       |
| UI Library    | PrimeVue (+ optional Tailwind CSS)              |
| Backend / API | Nuxt 3 server routes                            |
| Database      | PostgreSQL                                      |
| Deployment    | Docker / Docker Compose                         |
| PWA           | Nuxt PWA module (service worker, offline cache) |

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

| Path                   | Contents                                              |
| ---------------------- | ----------------------------------------------------- |
| `docs/vision.md`       | System overview, domain model, roles, lifecycle, NFRs |
| `docs/wbs.md`          | Feature list with priorities                          |
| `openspec/specs/`      | Behavioral specs – source of truth for implementation |
| `openspec/changes/`    | Active and archived change proposals                  |
| `openspec/config.yaml` | OpenSpec workflow rules                               |

## Current Phase

- [x] Technical business specification + OpenSpec initialization.
- [ ] MVP.

## Language

All text files (documentation, diagrams, ADRs, specs) must be in English.

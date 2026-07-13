# System Vision – OSI Time Tracker

`osi.time.tracker` - technical name,  
`OSI Time Tracker` - product name

## Context

**OSI Time Tracker** is a personal time tracking web application built for IT specialists who work across multiple clients and projects. It is a self-hosted, open-source tool designed to give individual users full ownership of their time data.

Each registered user operates in a fully isolated workspace — there are no shared workspaces, no teams, and no cross-user visibility. The application supports multiple independent users on the same installation, each with their own data silo.

---

## Problem Being Solved

IT specialists working with multiple clients face a recurring challenge: their clients use different issue tracking systems (Redmine, OpenProject, etc.), but there is no lightweight, self-hosted tool that:

1. Tracks time locally in a structured hierarchy (Client → Project → Task),
2. Allows associating local tasks with remote issues in external trackers, and
3. Pushes time entries to those remote systems on demand — without requiring the user to manually re-enter data in each client's tool.

Existing solutions are either too heavyweight (full project management suites), SaaS-only (data leaves the user's control), or lack the remote integration model needed for multi-client consulting work.

---

## System Overview

**OSI Time Tracker** is a web application (PWA-capable) with the following core feature areas:

- **Time Tracking** — start/stop a live timer or create manual time entries; **time entries are the primary objects the user creates**
- **Timer View** — the main working page: time entries listed per day, grouped by Task, expandable to individual entries
- **Data Hierarchy** — organize work under Clients → Projects; Tasks are created and matched implicitly from time entry titles
- **Reporting** — view summaries by client/project and weekly timesheets (the Timer View doubles as the daily timesheet)
- **Remote Integration** — link local tasks to remote issues (Redmine, OpenProject) and push time entries on demand
- **User Settings** — timezone, week start day, language, rounding preferences

The application is self-hosted via Docker. Each user has an isolated account and manages their own data.

---

## Domain Model

The model is **entry-first**: the primary object a user creates is a `TimeEntry`. `Task`s are derived grouping entities — created, matched, renamed, merged, and garbage-collected automatically from entry titles. There is no dedicated task management page.

```
User
 ├─► Client
 │     ├─► RemoteSystemConfig (optional, one per remote system type)
 │     └─► Project
 ├─► Task (auto-created / auto-matched; projectId nullable ──► Project)
 │     └─► RemoteIssueRef (optional)
 └─► TimeEntry (taskId nullable ──► Task)
```

A `TimeEntry` optionally points to a `Task` — the task's name is what the user perceives as the entry's "title". A `Task` optionally belongs to a `Project`; a project-less Task is owned directly by the User and is not grouped under any Client or Project.

### Entities

| Entity                 | Description                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User**               | A registered account. Owns all data beneath it. Fully isolated from other users.                                                                                                                                                                                                                                                                 |
| **Client**             | A company or person the user works for. Top-level grouping for projects. Holds remote system configuration for that client's issue tracker.                                                                                                                                                                                                      |
| **RemoteSystemConfig** | Configuration for a remote issue tracker associated with a Client. The full config (system type, base URL, adapter execution mode, rounding rule, and optional defaults for required remote fields) is stored in the database. For client-side mode (the only MVP mode) only the API secret/credential is held in the user's browser and never persisted server-side; backend-side mode (post-MVP) stores credentials encrypted server-side. |
| **Project**            | A body of work for a Client. Contains tasks.                                                                                                                                                                                                                                                                                                     |
| **Task**               | A derived unit of work grouping time entries. Auto-created or auto-matched when the user titles a time entry; renamed via the group header in the Timer View; hard-deleted (garbage-collected) when its last entry leaves. Has a name and an optional Project. No status, no number, no description. May optionally be linked to a remote issue. |
| **TimeEntry**          | A single logged time interval (`startedAt` + `stoppedAt`; a running timer is an entry with no stop time). Carries no title of its own — its displayed title is the name of the Task it points to (`taskId` nullable ⇒ shown as "(no task)").                                                                                                     |
| **RemoteIssueRef**     | An optional link from a Task to a specific issue in the client's remote system. Stores only the remote issue ID and relevant issue metadata (title, URL).                                                                                                                                                                                        |

A `Client` holds the `RemoteSystemConfig` (connection details, credentials, adapter mode). A `Task` holds a `RemoteIssueRef` that references only the remote issue identifier and metadata — it does not duplicate connection details. When a `TimeEntry` is pushed, the adapter reads the connection config from the parent `Client` and the issue reference from the parent `Task`.

### Entry-First Semantics

1. **Title = task binding.** A time entry's "title" is the name of the Task it points to. There is no separate description field on entries — the title is the only text.
2. **Task matching key is `(user, name, project)`.** `project = none` is a scope of its own: at most one project-less "Code review" may exist, plus one per project.
3. **Autocomplete & silent match.** While typing a title, existing Tasks (name + project context) are suggested. Picking one binds the entry to it. Typing an existing name without picking: if the existing task is project-less, the entry silently binds to it; if the existing task has a project, a new project-less Task is created.
4. **Editing scope.** Retitling a **single entry** splits/reassigns it to another (or a new) Task. Editing a **group's** title in the Timer View renames the Task itself — the typo fix that applies everywhere.
5. **Auto-merge invariant.** After any task mutation (rename, project assignment), if two Tasks share `(name, project)` they merge: entries move to the survivor, the emptied Task is garbage-collected. Merges are irreversible. _Future guard:_ once `RemoteIssueRef`s exist, a merge where both Tasks hold a ref must block or ask the user.
6. **Untitled entries** (`taskId = null`) group into one "(no task)" bucket per day. Typing a title into the bucket header bulk-assigns all of that day's untitled entries to the matched/created Task.
7. **Group row = mini task editor.** The group header in the Timer View (title + project selector) is the only task-editing surface. "(no project)" is a visible state nudging assignment for reports.
8. **Task lifecycle is implicit.** Users never manage Tasks directly: Tasks are hard-deleted (no soft delete) when their last entry leaves. Clients and Projects keep soft-delete semantics.
9. **Running timer = TimeEntry with no stop time.** Persisted server-side; at most one running entry per user. Duration is always derived (`stoppedAt − startedAt`).
10. **Tie-breaker:** where behavior is unspecified, follow Toggl's handling.

---

## User Roles & Access

There is a single role in the system: **User**.

| Role     | Description                                              |
| -------- | -------------------------------------------------------- |
| **User** | An account with full CRUD access to their own data only. |

- No admin role, no team hierarchy, no cross-user visibility.
- Every user's data (clients, projects, tasks, time entries) is strictly isolated.
- Account provisioning (MVP): a bootstrap user is provisioned via environment variables (`BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD`). Self-registration (email + password) is planned for V1.1.

---

## Core User Journey (MVP)

```
Log in (bootstrap-provisioned account; self-registration in V1.1)
    ├─► (Optional) Create Client ─► Create Project under Client
    │         └─► (Optional) Configure RemoteSystemConfig on Client
    │               (system type, base URL, API credentials, adapter mode, rounding rule)
    └─► Start Timer  ──OR──  Create Manual Entry      ← the primary action; title optional
          ├─► Type a title → autocomplete suggests existing Tasks (name + project)
          │     ├─► Pick one → entry binds to that Task
          │     └─► New title → Task auto-created behind the scenes
          ├─► Leave untitled → entry lands in the day's "(no task)" bucket (title it later)
          └─► Stop Timer → TimeEntry saved
                └─► Timer View: entries per day, grouped by Task
                      ├─► Expand a group → edit individual entries (retitle = split/reassign)
                      ├─► Group header = mini task editor (rename Task, assign Project)
                      ├─► Continue (▶) → start a new entry on the same Task
                      └─► (Optional) Link Task to remote issue
                            └─► Open the day's Remote Sync page → review rounded per-task totals + required fields → push the day
                                  (one remote log per task; pushed entries and their tasks lock)
```

---

## Time Entry Lifecycle

```
          ┌─────────┐
          │ Running │  ← timer started
          └────┬────┘
               │ stop
          ┌────▼────┐
          │ Stopped │  ← time entry saved (editable)
          └────┬────┘
               │ push (optional, requires RemoteIssueRef on parent Task)
      ┌────────▼─────────┐
      │ Pushed to Remote │  ← time entry sent to external system via adapter
      └──────────────────┘
```

A running timer **is** a TimeEntry with no stop time — persisted server-side, at most one per user. A time entry can also be created directly in the `Stopped` state via manual entry (no timer involved). Duration is always derived from the two timestamps. Once pushed via Remote Sync, an entry is **locked** (start/stop immutable, no delete) and a task holding any locked entry is locked (Project/Client immutable); the remote is never auto-mutated, retries are duplicate-safe, and there is no unlock in MVP (see the Push lock cascade and NFR 8.8).

---

## Remote Integration (External Issue Trackers)

### Model

Remote integration is configured at the **Client** level via a `RemoteSystemConfig`. Each client may have one remote system configuration, which stores:

- **System type** (e.g. `redmine`, `openproject`)
- **Base URL** of the remote system
- **API credentials** (API key or token) — storage depends on execution mode: **client-side** configs (**the only MVP mode**) keep them **only in the user's browser** and never persist them to the server (the rest of the config is still stored in the database); **backend-side** configs (**post-MVP**) store them **encrypted server-side**.
- **Adapter execution mode** (`client-side` or `backend-side` — see below)
- **Rounding rule** (e.g. round up to nearest 15 minutes)
- **Required remote fields** — some systems require extra fields on a time log (e.g. Redmine `activity_id`). The config may store adapter-fetched defaults; values can also be chosen on the Remote Sync page at push time.

A `Task` may optionally hold a `RemoteIssueRef` — a lightweight reference to a specific issue in the client's remote system. It stores only:

- **Remote issue ID** (numeric or string identifier used by the remote system)
- **Issue title / summary** (cached for display purposes)
- **Remote issue URL** (for direct linking)

### Fetching Remote Issues

The user can browse and search issues from the configured remote system directly within the app. This enables two workflows:

1. **Link from a Task's group row in the Timer View** — pick a remote issue from a search/browse dialog to attach a `RemoteIssueRef` to the task.
2. **Start time entry from remote issue** — a dedicated view lists open remote issues; the user selects one and immediately starts a timer, with the task and remote link pre-populated.

### Remote Sync (day-level push)

From the Timer view the user opens a **Remote Sync** page for a selected day. It lists that day's **pushable tasks** — tasks with entries that day whose Project → Client has a `RemoteSystemConfig`. Each row shows:

- the Task and its **rounded aggregate time** for the day (the day's entries for the task summed, then rounded once via the configured rounding rule);
- the linked **remote issue** (assignable/changeable inline if not yet linked);
- any **required remote fields** for that system (adapter-provided options where available, otherwise plain input; a task's previously used value pre-filled where possible).

On confirm, a single action pushes the day: for each pushable task the adapter creates **one remote time log** against the linked issue with the rounded duration and required fields. A per-task success/failure summary is shown.

### Push lock cascade

- On successful push, that day's pushed `TimeEntry` records are **locked**: their start/stop times cannot be edited and they cannot be deleted.
- A `Task` that holds **any** locked entry is itself **locked**: its Project/Client cannot be changed (protecting the pushable grouping).
- The remote counterpart is **never** auto-updated or deleted; there is **no unlock in MVP**.
- Push retry is **idempotency-guarded** via the stored remote log ID so retries never create duplicates.

### Rounding

Rounding is configurable per `RemoteSystemConfig` (e.g. round up to nearest 15 minutes). This is needed because some external systems (e.g. Redmine) enforce minimum time increments.

### Adapter Execution Modes

Some remote systems are hosted behind a client's VPN and are not reachable from the application's backend server. To support this, each adapter can run in one of two modes:

| Mode             | Where it runs      | Use case                                                                                  |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| **Backend-side** | Application server | Remote system is publicly reachable; API calls are made server-to-server.                 |
| **Client-side**  | User's browser     | Remote system is behind a VPN; the browser (already on the VPN) makes API calls directly. |

The execution mode is configured per `RemoteSystemConfig`. **MVP ships only the client-side mode**, where credentials are entered and held **only in the user's browser** and are never persisted to the server (the rest of the config still lives in the database). **Backend-side** mode (credentials encrypted server-side, server-to-server calls) is a **post-MVP** capability. The adapter interface is identical in both modes; only the execution context and credential handling differ. CORS must be enabled on the remote system for client-side mode to work.

### Adapter Model

Each supported remote system is implemented as an **adapter** (plugin). The adapter interface is stable; new systems can be added without changing core logic.

Each adapter is implemented as a **transport-agnostic core** (request building + response parsing) in `shared/`, wrapped by thin **server-side** and **browser-side** transports that supply authentication and handle CORS. The core is identical across execution modes; only the transport differs. **For MVP, only the OpenProject adapter and only the browser-side transport are built**; the Redmine adapter and the server-side transport are deferred to the end of / after MVP.

| Adapter        | Status                |
| -------------- | --------------------- |
| OpenProject    | MVP                   |
| Redmine        | End of MVP (deferred) |
| _(extensible)_ | Future                |

---

## Technology Decisions

| Component     | Technology                                      |
| ------------- | ----------------------------------------------- |
| Frontend      | Nuxt 4, Vue 3, TypeScript                       |
| UI Library    | PrimeVue                                        |
| Backend / API | Nuxt 4 server routes                            |
| Database      | PostgreSQL ≥ 18 (native `uuidv7()`)             |
| Deployment    | Docker / Docker Compose                         |
| PWA           | Nuxt PWA module (service worker, offline cache) |

---

## Non-Functional Highlights

| Concern                  | Decision                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PWA / Offline**        | App installable on desktop and mobile; the running timer is server-persisted — an offline layer (local caching/sync) is added on top later (V1.1+).                                                                 |
| **GDPR**                 | Right to erasure (account + all data deletion), data export (JSON/CSV).                                                                                                                                             |
| **Security (OWASP)**     | OWASP Top 10 baseline: input validation, rate limiting, CSP headers, secure cookies.                                                                                                                                |
| **Internationalization** | i18n-ready from day one; `en` (default) + `pl` shipped; additional locales addable without refactor. Locale resolved via cookie → `Accept-Language` → `en`; persisted in cookie only until User Settings (WBS 7.4). |
| **Accessibility**        | WCAG 2.1 AA target (enforced by `openspec/specs/accessibility/spec.md`).                                                                                                                                            |
| **Deployment**           | Self-hosted via Docker Compose; no SaaS dependency.                                                                                                                                                                 |

---

## Explicit Out-of-Scope

- **Billing & invoicing** — no hourly rates, no invoice generation or export
- **Team features** — no shared workspaces, no roles within a team, no cross-user visibility
- **Real-time / background sync** — no automatic background push to remote systems; all pushes are on-demand
- **Admin-managed accounts** — no administrator role; accounts are bootstrap-provisioned (MVP) and self-registered (V1.1)
- **Task management UI** — no dedicated tasks page; Tasks are created, renamed, merged, and deleted implicitly via time entries and the Timer View group rows
- **Task metadata** — no task status, numbers, or descriptions; a Task is only a name plus an optional Project
- **Automatic import of remote tasks** — remote issues are fetched on demand for linking/browsing; no background import or local copy of the full remote task list
- **Mobile native apps** — web/PWA only; no iOS or Android native app
- **SLA / time budgets** — no project budget tracking or deadline enforcement

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

- **Time Tracking** — start/stop a live timer or create manual time entries
- **Data Hierarchy** — organize work under Clients → Projects → Tasks
- **Reporting** — view summaries by client/project and daily/weekly timesheets
- **Remote Integration** — link local tasks to remote issues (Redmine, OpenProject) and push time entries on demand
- **User Settings** — timezone, week start day, language, rounding preferences

The application is self-hosted via Docker. Each user registers independently and manages their own isolated data.

---

## Domain Model

The core domain hierarchy is:

```
User
 └─► Client
       ├─► RemoteSystemConfig (optional, one per remote system type)
       └─► Project
             └─► Task
                   ├─► TimeEntry (one or many)
                   └─► RemoteIssueRef (optional)
```

### Entities

| Entity                 | Description                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User**               | A registered account. Owns all data beneath it. Fully isolated from other users.                                                                             |
| **Client**             | A company or person the user works for. Top-level grouping for projects. Holds remote system configuration for that client's issue tracker.                  |
| **RemoteSystemConfig** | Configuration for a remote issue tracker associated with a Client. Stores system type, base URL, API credentials, adapter execution mode, and rounding rule. |
| **Project**            | A body of work for a Client. Contains tasks.                                                                                                                 |
| **Task**               | A unit of work within a Project. Time is logged against a Task. May optionally be linked to a remote issue.                                                  |
| **TimeEntry**          | A single logged time interval (start time, end time or duration) attached to a Task.                                                                         |
| **RemoteIssueRef**     | An optional link from a Task to a specific issue in the client's remote system. Stores only the remote issue ID and relevant issue metadata (title, URL).    |

A `Client` holds the `RemoteSystemConfig` (connection details, credentials, adapter mode). A `Task` holds a `RemoteIssueRef` that references only the remote issue identifier and metadata — it does not duplicate connection details. When a `TimeEntry` is pushed, the adapter reads the connection config from the parent `Client` and the issue reference from the parent `Task`.

---

## User Roles & Access

There is a single role in the system: **User**.

| Role     | Description                                                             |
| -------- | ----------------------------------------------------------------------- |
| **User** | A self-registered account. Has full CRUD access to their own data only. |

- No admin role, no team hierarchy, no cross-user visibility.
- Every user's data (clients, projects, tasks, time entries) is strictly isolated.
- Account provisioning is via self-registration (email + password).

---

## Core User Journey (MVP)

```
Register (email + password)
    └─► Log in
        └─► Create Client
              ├─► (Optional) Configure RemoteSystemConfig on Client
              │     (system type, base URL, API credentials, adapter mode, rounding rule)
              └─► Create Project under Client
                    └─► Create Task under Project
                          ├─► (Optional) Link Task to remote issue
                          │     ├─► Browse / search remote issues from configured system
                          │     └─► Attach RemoteIssueRef (issue ID + cached title/URL)
                          └─► Start Timer  ──OR──  Create Manual Entry
                                └─► Stop Timer → TimeEntry created
                                      ├─► Review / edit TimeEntry
                                      └─► (Optional) Push to remote system
                                            ├─► Push single TimeEntry on demand
                                            └─► (V1.1) Push all entries for a day
                                                  (rounding applied per entry before push)
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

A time entry can also be created directly in the `Stopped` state via manual entry (no timer involved).

---

## Remote Integration (External Issue Trackers)

### Model

Remote integration is configured at the **Client** level via a `RemoteSystemConfig`. Each client may have one remote system configuration, which stores:

- **System type** (e.g. `redmine`, `openproject`)
- **Base URL** of the remote system
- **API credentials** (API key or token, stored securely per user)
- **Adapter execution mode** (`client-side` or `backend-side` — see below)
- **Rounding rule** (e.g. round up to nearest 15 minutes)

A `Task` may optionally hold a `RemoteIssueRef` — a lightweight reference to a specific issue in the client's remote system. It stores only:

- **Remote issue ID** (numeric or string identifier used by the remote system)
- **Issue title / summary** (cached for display purposes)
- **Remote issue URL** (for direct linking)

### Fetching Remote Issues

The user can browse and search issues from the configured remote system directly within the app. This enables two workflows:

1. **Link while creating/editing a Task** — pick a remote issue from a search/browse dialog to attach a `RemoteIssueRef` to the task.
2. **Start time entry from remote issue** — a dedicated view lists open remote issues; the user selects one and immediately starts a timer, with the task and remote link pre-populated.

### Push Flow

**Single entry push (MVP):** The user triggers a push for one `TimeEntry`:

1. The adapter reads the `RemoteSystemConfig` from the parent `Client` (base URL, credentials, rounding rule).
2. The adapter reads the `RemoteIssueRef` from the parent `Task` to identify the target issue.
3. The adapter applies the configured **rounding rule** (if any) to the duration.
4. The adapter calls the remote API to create a time entry on the remote issue.
5. The result (success / error) is shown to the user. The local `TimeEntry` is marked as pushed.

**Day-level bulk push (V1.1):** The user selects a day and triggers a push for all unpushed entries that have a `RemoteIssueRef`:

1. The system collects all unpushed `TimeEntry` records for the selected day that are linked to a remote issue.
2. For each entry, the adapter applies the configured rounding rule to the duration.
3. Each rounded entry is pushed to its respective remote issue via the adapter.
4. A summary of successes and failures is shown. Successfully pushed entries are marked as pushed.

### Rounding

Rounding is configurable per `RemoteSystemConfig` (e.g. round up to nearest 15 minutes). This is needed because some external systems (e.g. Redmine) enforce minimum time increments.

### Adapter Execution Modes

Some remote systems are hosted behind a client's VPN and are not reachable from the application's backend server. To support this, each adapter can run in one of two modes:

| Mode             | Where it runs      | Use case                                                                                  |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| **Backend-side** | Application server | Remote system is publicly reachable; API calls are made server-to-server.                 |
| **Client-side**  | User's browser     | Remote system is behind a VPN; the browser (already on the VPN) makes API calls directly. |

The execution mode is configured per `RemoteSystemConfig`. The adapter interface is identical in both modes; only the execution context differs. CORS must be enabled on the remote system for client-side mode to work.

### Adapter Model

Each supported remote system is implemented as an **adapter** (plugin). The adapter interface is stable; new systems can be added without changing core logic.

| Adapter        | Status |
| -------------- | ------ |
| Redmine        | MVP    |
| OpenProject    | MVP    |
| _(extensible)_ | Future |

---

## Technology Decisions

| Component     | Technology                                      |
| ------------- | ----------------------------------------------- |
| Frontend      | Nuxt 4, Vue 3, TypeScript                       |
| UI Library    | PrimeVue (+ optional Tailwind CSS)              |
| Backend / API | Nuxt 4 server routes (or separate Node service) |
| Database      | PostgreSQL                                      |
| Deployment    | Docker / Docker Compose                         |
| PWA           | Nuxt PWA module (service worker, offline cache) |

---

## Non-Functional Highlights

| Concern                  | Decision                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PWA / Offline**        | Timer state persisted locally; app installable on desktop and mobile.                                                                                                                                               |
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
- **Admin-managed accounts** — no administrator role; all accounts are self-registered
- **Automatic import of remote tasks** — remote issues are fetched on demand for linking/browsing; no background import or local copy of the full remote task list
- **Mobile native apps** — web/PWA only; no iOS or Android native app
- **SLA / time budgets** — no project budget tracking or deadline enforcement

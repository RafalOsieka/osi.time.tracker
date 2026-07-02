# User Stories – OSI Time Tracker MVP

This document lists the remaining 🔴 MVP user stories (see `docs/wbs.md`) in the order they should be delivered. Each story is an independently shippable vertical slice (schema → API → UI → tests) that builds on the previous ones. Stories assume the existing foundation: authentication, the `users` schema, i18n (`en`/`pl`), theming, Docker, and accessibility (WCAG 2.1 AA).

Conventions that apply to every story:

- All data is strictly scoped to the authenticated user; cross-user access is impossible (WBS 8.7).
- Times are stored in UTC and displayed in the user's timezone.
- Mutating endpoints are guarded by `requireAuth` + CSRF; API errors use the `{ messageKey, params }` contract.
- All user-facing strings live in `i18n/locales/{en,pl}.json` and stay in parity.

---

## 1. Authenticated app shell & Client management

> **As a user, I want an authenticated app shell and to create, edit, delete, and list my Clients, so I can organize my work by the companies I work for.** (WBS 3.1)

**Acceptance criteria**

- After logging in, I see a persistent authenticated app shell with navigation.
- I can create a Client with a name.
- I can view a list of only my own Clients.
- I can edit and delete a Client.
- Another user can never see or access my Clients.

---

## 2. Project management

> **As a user, I want to create, edit, delete, and list Projects under a Client, so I can group related bodies of work.** (WBS 3.2)

**Acceptance criteria**

- I can create a Project, choosing which of my Clients it belongs to.
- I can list Projects, filterable by Client, and see a Client's Projects on its detail view.
- I can edit and delete a Project.
- I cannot assign a Project to a Client I don't own.

---

## 3. Task management

> **As a user, I want to create, edit, delete, and list Tasks (optionally under a Project), so I can track work at the level I log time against.** (WBS 3.3)

**Acceptance criteria**

- I can create a Task, optionally choosing which of my Projects it belongs to; a Task without a Project is allowed.
- I can list Tasks, filterable by Project (including a filter for project-less Tasks), and see a Project's Tasks on its detail view.
- I can edit and delete a Task, including assigning or removing its Project.
- I cannot assign a Task to a Project I don't own.

---

## 4. Live timer & running indicator

> **As a user, I want to start and stop a single live timer and always see a running-timer indicator, so I can capture time as I work without forgetting it's running.** (WBS 2.1, 2.9)

**Acceptance criteria**

- I can start a timer against one of my Tasks; only one timer can be active at a time.
- Starting a timer while one is already running is prevented (or stops/replaces the active one per defined behavior).
- I can stop the timer, which produces a saved TimeEntry.
- A running-timer indicator is visible in the app shell whenever a timer is active.
- Timer state is persisted server-side and survives reloads.

---

## 5. Manual entries, edit, delete & list

> **As a user, I want to add manual time entries and edit, delete, and browse my time entries, so I can record and correct time I didn't capture with the timer.** (WBS 2.2–2.5)

**Acceptance criteria**

- I can create a manual TimeEntry with a start/end (or duration), a Task, and a free-text description.
- I can edit a TimeEntry's start, end, duration, task, and description.
- I can delete a TimeEntry.
- I can browse a list of my time entries, filterable by date range.
- I can only act on entries belonging to my own Tasks.

---

## 6. User settings (timezone & week start)

> **As a user, I want to set my timezone and week-start day, so times and weekly reports display correctly for me.** (WBS 7.1, 7.2)

**Acceptance criteria**

- I can pick my timezone; stored times (UTC) are displayed converted to it.
- I can choose my week-start day (Monday/Sunday).
- These preferences are persisted on my account and applied across the app.

---

## 7. Reporting & timesheets

> **As a user, I want client/project summaries and daily and weekly timesheets filtered by date range, so I can review where my time went.** (WBS 4.1–4.4)

**Acceptance criteria**

- I can see total hours grouped by Client and Project for a selected date range.
- I can see a daily timesheet (entries for a day, grouped by Task).
- I can see a weekly timesheet (hours per day across a week), honoring my week-start day.
- I can filter all reports by an arbitrary start/end date.
- Grouping and totals respect my timezone and week-start preferences.

---

## 8. Remote system configuration & secure credentials

> **As a user, I want to configure a remote issue tracker per Client with an execution mode and rounding rule, with my credentials stored securely, so I can later link issues and push time.** (WBS 5.1–5.4)

**Acceptance criteria**

- I can configure a RemoteSystemConfig on a Client: system type (redmine/openproject), base URL, API credentials, execution mode (backend/client), and rounding rule.
- My credentials are stored encrypted and never returned to the client in plaintext.
- I can edit and remove a Client's remote configuration.

---

## 9. Adapters: browse, link & start timer from remote issues

> **As a user, I want to browse/search remote issues, link a Task to a remote issue, and start a timer directly from an issue, so my local work maps to the client's tracker.** (WBS 5.5–5.7, fetch side of 5.13–5.14)

**Acceptance criteria**

- I can browse/search open issues from a Client's configured remote system (Redmine and OpenProject), in backend or client-side execution mode.
- I can link a remote issue to a Task, storing the issue ID and cached title/URL (RemoteIssueRef).
- I can unlink a remote issue from a Task.
- I can open a remote-issue view and start a timer with the Task and remote link pre-populated.

---

## 10. Push time entries with rounding, status & error handling

> **As a user, I want to push a single time entry to the linked remote issue on demand, with rounding applied and status tracked, so my logged time reaches the client's system reliably.** (WBS 5.8–5.11)

**Acceptance criteria**

- I can trigger a push for one TimeEntry on demand.
- The push is only allowed when the parent Task has a RemoteIssueRef and the Client has a RemoteSystemConfig.
- The configured rounding rule is applied to the duration before sending.
- On success, the entry is marked pushed with a push timestamp and remote entry ID.
- On failure, a clear error message is shown and I can retry; the entry is never silently lost.

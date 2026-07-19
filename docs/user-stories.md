# User Stories – OSI Time Tracker MVP

This document lists the 🔴 MVP user stories (see `docs/wbs.md`) in the order they should be delivered. Each story is an independently shippable vertical slice (schema → API → UI → tests) that builds on the previous ones. Stories assume the existing foundation: authentication, the `users` schema, i18n (`en`/`pl`), theming, Docker, and accessibility (WCAG 2.1 AA).

The domain model is **entry-first** (see `docs/vision.md`, "Entry-First Semantics"): the user creates time entries; Tasks are auto-created/auto-matched from entry titles and have no dedicated management page.

Conventions that apply to every story:

- All data is strictly scoped to the authenticated user; cross-user access is impossible (WBS 8.7).
- Times are stored in UTC and displayed in the user's timezone.
- Mutating endpoints are guarded by `requireAuth` + CSRF; API errors use the `{ messageKey, params }` contract.
- All user-facing strings live in `i18n/locales/{en,pl}.json` and stay in parity.

---

## 1. Authenticated app shell & Client management ✅ Delivered

> **As a user, I want an authenticated app shell and to create, edit, delete, and list my Clients, so I can organize my work by the companies I work for.** (WBS 3.1)

**Acceptance criteria**

- After logging in, I see a persistent authenticated app shell with navigation.
- I can create a Client with a name.
- I can view a list of only my own Clients.
- I can edit and delete a Client.
- Another user can never see or access my Clients.

---

## 2. Project management ✅ Delivered

> **As a user, I want to create, edit, delete, and list Projects under a Client, so I can group related bodies of work.** (WBS 3.2)

**Acceptance criteria**

- I can create a Project, choosing which of my Clients it belongs to.
- I can list Projects, filterable by Client.
- I can edit and delete a Project.
- I cannot assign a Project to a Client I don't own.

---

## 3. Task management page ✅ Delivered — ⚠️ superseded

> Delivered as an explicit Task CRUD page (WBS 3.3 in its original task-first form). The entry-first model supersedes it: the tasks page and per-user task numbers are to be **removed** as part of story 5 (Timer view). The underlying task table, API plumbing, and shared UI patterns are reused by the implicit task lifecycle.

---

## 4. Live timer, titled entries & running indicator ✅ Delivered

> **As a user, I want to start and stop a single live timer with an optional title that binds the entry to a Task behind the scenes, and always see a running-timer indicator, so I can capture time as I work without managing tasks upfront.** (WBS 2.1, 2.5, 2.9, 3.3)

**Acceptance criteria**

- I can start a timer with an optional title; a running timer is a TimeEntry with no stop time, persisted server-side, surviving reloads.
- While typing a title, autocomplete suggests my existing Tasks (name + project context); picking one binds the entry to it.
- Typing a new title creates a Task behind the scenes; typing an existing project-less task's name without picking silently binds to it; if the existing task has a project, a new project-less Task is created.
- I can leave the title empty — the entry stays unassigned (`taskId = null`).
- Only one timer can be active at a time; starting a new one follows Toggl behavior (stops the running one).
- I can stop the timer, which completes the TimeEntry.
- A running-timer indicator is visible in the app shell whenever a timer is active.

---

## 5. Timer view page (daily entries, grouped by Task) ✅ Delivered

> **As a user, I want a timer view page listing my time entries per day, grouped by Task and expandable to individual entries, so I can review and organize my logged time in one place.** (WBS 2.10, 3.3; absorbs 4.2)

**Acceptance criteria**

- I see my time entries listed per day (newest first), with a per-day total.
- Entries of the same Task within a day are grouped into one row showing entry count and summed duration; the group expands to individual entries.
- Untitled entries group into one "(no task)" bucket per day; typing a title into the bucket header bulk-assigns all of that day's untitled entries.
- The group header is a mini task editor: renaming it renames the Task everywhere; a project selector assigns/changes the Task's project ("(no project)" is a visible state).
- After any task rename or project assignment, Tasks colliding on `(name, project)` auto-merge; emptied Tasks are hard-deleted.
- A continue (▶) action on a group/entry starts a new timer bound to the same Task.
- The dedicated tasks page and per-user task numbers are removed.

---

## 6. Manual entries, edit & delete ✅ Delivered

> **As a user, I want to add manual time entries and edit or delete existing entries, so I can record and correct time I didn't capture with the timer.** (WBS 2.2–2.4)

**Acceptance criteria**

- I can create a manual TimeEntry with a start/end (or duration) and an optional title (same autocomplete/binding rules as the timer).
- I can edit a TimeEntry's start and stop times.
- I can edit the running timer's start time from the top bar (a date and hours+minutes field), which rebases the elapsed time shown; a resulting future start is blocked.
- I can retitle a single entry, which splits/reassigns it to another (or a new) Task via autocomplete — the rest of the group is unaffected.
- I can delete a TimeEntry; a Task whose last entry is removed is garbage-collected (hard delete).
- I can only act on my own entries.

---

## 7. User settings (timezone & week start) ✅ Delivered

> **As a user, I want to set my timezone and week-start day, so times and weekly reports display correctly for me.** (WBS 7.1, 7.2)

**Acceptance criteria**

- I can pick my timezone; stored times (UTC) are displayed converted to it.
- I can choose my week-start day (Monday/Sunday).
- These preferences are persisted on my account and applied across the app.

---

## 8. Reporting & timesheets

> **As a user, I want client/project summaries and weekly timesheets filtered by date range, so I can review where my time went.** (WBS 4.1, 4.3, 4.4)

**Acceptance criteria**

- I can see total hours grouped by Client and Project for a selected date range; project-less Tasks appear as an explicit "(no project)" row.
- I can see a weekly timesheet (hours per day across a week), honoring my week-start day.
- I can filter all reports by an arbitrary start/end date.
- Grouping and totals respect my timezone and week-start preferences.
- The daily view is the Timer view page (story 5) — no separate daily report.

---

## 9. Remote system configuration & secure credentials ✅ Delivered

> **As a user, I want to configure a remote issue tracker per Client with an execution mode and rounding rule, with my credentials stored securely, so I can later link issues and push time.** (WBS 5.1–5.4)

**Acceptance criteria**

- I can configure a RemoteSystemConfig on a Client: system type (redmine/openproject), base URL, API credentials, execution mode (backend/client), and rounding rule. The full config except the API secret is stored in the database.
- For **client-side** configs (**the only MVP mode**), my credentials are entered and kept **only in my browser** and are never persisted to the server, while the rest of the config is still stored in the database.
- (Post-MVP) For **backend-side** configs, my credentials are stored encrypted and never returned to the client in plaintext.
- I can optionally set defaults for the remote system's **required fields** (e.g. Redmine activity), used to pre-fill the Remote Sync page.
- I can edit and remove a Client's remote configuration.

---

## 10a. Adapters: browse, search & link remote issues ✅ Delivered

> **As a user, I want to browse/search remote issues and link/unlink a Task to a remote issue, so my local work maps to the client's tracker.** (WBS 5.5–5.6, fetch side of 5.14–5.15)

**Acceptance criteria**

- I can browse/search open issues from a Client's configured remote system (**OpenProject** for MVP; **Redmine** at the end of MVP), in **client-side** execution mode (backend-side is post-MVP).
- I can link a remote issue to a Task from its group row in the Timer view (and inline on the Remote Sync page), storing the issue ID and cached title/URL (RemoteIssueRef).
- I can unlink a remote issue from a Task.
- A task merge where both Tasks hold a RemoteIssueRef is blocked (or requires an explicit choice).

---

## 10b. Start a timer from a remote issue

> **As a user, I want to open a remote-issue view and start a timer directly from an issue, so the Task and remote link are pre-populated.** (WBS 5.7)

**Acceptance criteria**

- I can open a remote-issue view listing issues from a configured Client's tracker.
- Selecting an issue starts a timer with the Task and remote link pre-populated.

---

## 11a. Remote Sync: per-day review page ✅ Delivered

> **As a user, I want a per-day Remote Sync page that shows all of a day's tasks with editable rounded times and required remote fields, so I can review a whole day's time before exporting it to the client's tracker.** (WBS 5.8, 5.9, 5.12)

**Acceptance criteria**

- From the Timer view I can open a Remote Sync page for a specific day.
- It lists **all** of that day's tasks (including a read-only "(no task)" bucket), each in an explicit state:
  - **read-only** with a stated reason — no Project/Client, Client has no RemoteSystemConfig, unsupported system type, successful empty activity fetch, or retryable remote load failure;
  - **read-only but linkable** — the task has no RemoteIssueRef; the link action is available inline and flips the row toward manageable;
  - **manageable** when prerequisites and activities are available.
- Each manageable task shows its **original duration**, **selected-entry total**, and an **editable export duration** pre-filled by applying the configured rounding rule once to the selected total. Eligible completed entries are selected by default. A value of **0** or an empty selection excludes the task from export.
- I can set required remote fields (e.g. OpenProject activity) with options fetched from the remote system; previously finalized values take precedence over config defaults.

---

## 11b. Remote Sync: user-controlled export ✅ Delivered

> **As a user, I want to export selected local entries to the client's tracker as one remote log per task, with remote-log context and non-locking provenance, so I can push intentionally and correct local data later.** (WBS 5.10, 5.11, 5.13, 5.14)

**Acceptance criteria**

- I choose which completed local entries to include per task; the browser creates at most one remote log per included task and finalizes each success locally.
- Successful exports append non-locking provenance (remote log id, exact duration, required fields, selected entry ids). Local entries and tasks remain editable/deletable.
- Same-day current-account remote logs are shown as informational context only and never infer local provenance or block export.
- Selecting previously exported entries requires explicit repeat-export confirmation; intentional repeats are allowed.
- Per-task outcomes report success, remote failure, or uncertain finalization (remote create succeeded, local finalize failed) and warn that retry may duplicate a remote log. Known finalized remote log ids are replayed without creating another remote log.
- Direct browser transport and authenticated Nitro proxy transport are both supported with equivalent behavior; the browser remains the batch orchestrator.

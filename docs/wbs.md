# Feature List – OSI Time Tracker

**Scope:** Personal time tracking web app with remote issue tracker integration  
**Platform:** Web (PWA-capable), self-hosted via Docker  
**Scale:** Single-user workspaces; multi-user installation supported

Priority legend: 🔴 MVP (must-have) | 🟡 V1.1 (should-have) | 🟢 Backlog (nice-to-have) | ⚫ Will-not-have

---

## Glossary

| Term                   | Definition                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User**               | A self-registered account. Owns all data beneath it. Fully isolated from other users on the same installation.                                               |
| **Client**             | A company or person the User works for. Top-level grouping for Projects.                                                                                     |
| **Project**            | A body of work for a Client. Contains Tasks.                                                                                                                 |
| **Task**               | A unit of work within a Project. Time is logged against a Task. May optionally be linked to a remote issue.                                                  |
| **TimeEntry**          | A single logged time interval (start time + end time, or duration) attached to a Task. Created by timer or manual entry.                                     |
| **RemoteSystemConfig** | Configuration for a remote issue tracker associated with a Client. Stores system type, base URL, API credentials, adapter execution mode, and rounding rule. |
| **RemoteIssueRef**     | An optional link from a Task to a specific issue in the client's remote system. Stores only the remote issue ID and cached metadata (title, URL).            |
| **Adapter**            | A plugin that implements the integration with a specific remote system (e.g. Redmine, OpenProject). Follows a stable interface.                              |
| **Rounding Rule**      | A configurable rule applied to a TimeEntry duration before pushing to a remote system (e.g. round up to nearest 15 minutes).                                 |

---

## 1. Authentication & Identity

| #   | Feature                                  | Priority | Notes                                                             |
| --- | ---------------------------------------- | -------- | ----------------------------------------------------------------- |
| 1.1 | Login / logout                           | 🔴       |                                                                   |
| 1.2 | Self-registration (email + password)     | 🟡       | Any visitor can create an account; each account is fully isolated |
| 1.3 | Password reset (email-based flow)        | 🟡       |                                                                   |
| 1.4 | Account deletion (GDPR right to erasure) | 🟡       | Deletes user account and all associated data                      |
| 1.5 | User profile management                  | 🟡       | Display name, email, avatar                                       |
| 1.6 | 2FA (TOTP)                               | 🟡       | Authenticator app (Google Authenticator, Authy, etc.)             |
| 1.7 | SSO / OAuth2 (Google, GitHub, etc.)      | 🟢       |                                                                   |
| 1.8 | Admin-managed account provisioning       | ⚫       | All accounts are self-registered; no admin role exists            |

---

## 2. Time Tracking (Timer + Manual Entry)

| #   | Feature                                     | Priority | Notes                                                                         |
| --- | ------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| 2.1 | Start / stop live timer                     | 🔴       | One active timer per user at a time; timer state persisted (PWA/offline-safe) |
| 2.2 | Manual time entry (start + end or duration) | 🔴       | Create a TimeEntry without using the timer                                    |
| 2.3 | Edit time entry                             | 🔴       | Change start time, end time, duration, task, description                      |
| 2.4 | Delete time entry                           | 🔴       |                                                                               |
| 2.5 | Description / notes on time entry           | 🔴       | Free-text field describing what was done                                      |
| 2.6 | Tags on time entries                        | 🟡       | User-defined labels for cross-cutting categorization                          |
| 2.7 | Duplicate time entry                        | 🟢       | Clone an existing entry as a starting point                                   |
| 2.8 | Bulk edit / delete time entries             | 🟢       |                                                                               |
| 2.9 | Running timer indicator (persistent UI)     | 🔴       | Visible in header/nav while timer is active                                   |

---

## 3. Data Hierarchy Management (Clients / Projects / Tasks)

| #   | Feature                                     | Priority | Notes                                                         |
| --- | ------------------------------------------- | -------- | ------------------------------------------------------------- |
| 3.1 | Create / edit / delete Client               | 🔴       |                                                               |
| 3.2 | Create / edit / delete Project              | 🔴       | Belongs to a Client                                           |
| 3.3 | Create / edit / delete Task                 | 🔴       | Belongs to a Project                                          |
| 3.4 | Archive / soft-delete Client, Project, Task | 🟡       | Archived items hidden from active views but data is preserved |
| 3.5 | Color labels on Clients / Projects          | 🟡       | Visual differentiation in lists and reports                   |
| 3.6 | Search / filter Clients, Projects, Tasks    | 🟡       |                                                               |
| 3.7 | Reorder / sort items                        | 🟢       |                                                               |

---

## 4. Reporting & Timesheets

| #   | Feature                                 | Priority | Notes                                                               |
| --- | --------------------------------------- | -------- | ------------------------------------------------------------------- |
| 4.1 | Summary report by Client / Project      | 🔴       | Total hours grouped by Client and Project for a selected date range |
| 4.2 | Daily timesheet view                    | 🔴       | All time entries for a given day, grouped by Task                   |
| 4.3 | Weekly timesheet view                   | 🔴       | Hours per day across a week, grouped by Project/Task                |
| 4.4 | Date range filter                       | 🔴       | Filter all reports by arbitrary start/end date                      |
| 4.5 | CSV export of time entries              | 🟡       | Export filtered data for use in spreadsheets or invoicing tools     |
| 4.6 | PDF export / printable timesheet        | 🟢       |                                                                     |
| 4.7 | Dashboard with charts                   | 🟢       | Visual breakdown of time by client/project over a period            |
| 4.8 | Billable / non-billable flag on entries | ⚫       | No billing concept in this application                              |

---

## 5. Remote Integration (External Issue Trackers)

### 5a. Remote System Configuration (per Client)

| #   | Feature                                       | Priority | Notes                                                                                                      |
| --- | --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 5.1 | Configure RemoteSystemConfig on a Client      | 🔴       | Set system type (redmine/openproject), base URL, API credentials, adapter execution mode, rounding rule    |
| 5.2 | Adapter execution mode: backend-side          | 🔴       | API calls made server-to-server; for publicly reachable remote systems                                     |
| 5.3 | Adapter execution mode: client-side (browser) | 🔴       | API calls made directly from the browser; for remote systems behind a VPN the user is already connected to |
| 5.4 | Secure credential storage (API key / token)   | 🔴       | Credentials stored encrypted per user; never exposed to other users                                        |

### 5b. Linking Tasks to Remote Issues

| #   | Feature                                            | Priority | Notes                                                                                                      |
| --- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 5.5 | Browse / search remote issues from within the app  | 🔴       | Fetch open issues from the configured remote system; display in a searchable list                          |
| 5.6 | Link a Task to a remote issue (RemoteIssueRef)     | 🔴       | Pick a remote issue from the browse dialog; stores issue ID + cached title/URL on the Task                 |
| 5.7 | Start time entry directly from a remote issue view | 🔴       | Dedicated view listing remote issues; selecting one starts a timer with task and remote link pre-populated |

### 5c. Pushing Time Entries

| #    | Feature                                            | Priority | Notes                                                                                                                                                                     |
| ---- | -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.8  | Push a single TimeEntry to remote system on demand | 🔴       | User triggers push manually; adapter sends time entry to the linked remote issue via API                                                                                  |
| 5.9  | Rounding rule applied on push                      | 🔴       | Configured per RemoteSystemConfig; e.g. round up to nearest 15 min                                                                                                        |
| 5.10 | Push status tracking on TimeEntry                  | 🔴       | Mark entry as pushed; store push timestamp and remote entry ID                                                                                                            |
| 5.11 | Error handling and user feedback on push failure   | 🔴       | Show error message; allow retry; do not silently fail                                                                                                                     |
| 5.12 | Bulk push all unpushed entries for a selected day  | 🟡       | Collects all unpushed entries with a RemoteIssueRef for a given day; applies rounding per entry; pushes each to its remote issue; shows per-entry success/failure summary |

### 5d. Adapters

| #    | Feature                                                | Priority | Notes                                                                                 |
| ---- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| 5.13 | Redmine adapter (fetch issues + push time entries)     | 🔴       | Uses Redmine REST API; supports both backend-side and client-side execution modes     |
| 5.14 | OpenProject adapter (fetch issues + push time entries) | 🔴       | Uses OpenProject REST API; supports both backend-side and client-side execution modes |
| 5.15 | Additional adapters (Jira, GitLab, etc.)               | 🟢       | Adapter interface is stable; new systems can be added in future                       |
| 5.16 | Real-time / background sync with remote systems        | ⚫       | All pushes and fetches are on-demand only                                             |

---

## 6. Notifications & Reminders

| #   | Feature                                    | Priority | Notes                                                           |
| --- | ------------------------------------------ | -------- | --------------------------------------------------------------- |
| 6.1 | Idle timer reminder (browser notification) | 🟡       | Alert user if timer has been running for an unusually long time |
| 6.2 | "No time logged today" reminder            | 🟡       | Optional daily nudge if no entries have been created            |
| 6.3 | Browser push notifications (PWA)           | 🟡       | Requires notification permission; used for reminders            |
| 6.4 | Email notifications                        | 🟢       |                                                                 |

---

## 7. User Settings & Preferences

| #   | Feature                          | Priority | Notes                                                                                                                                |
| --- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 7.1 | Timezone selection               | 🔴       | All times stored in UTC; displayed in user's local timezone                                                                          |
| 7.2 | Week start day (Monday / Sunday) | 🔴       | Affects weekly timesheet and report grouping                                                                                         |
| 7.3 | Default rounding rule            | 🟡       | Applied globally unless overridden per remote target                                                                                 |
| 7.4 | Language / locale selection      | 🟡       | UI language picker + persisted `locale` user column; cookie-only persistence in place since 8.4                                      |
| 7.5 | Date and time format preferences | 🟢       |                                                                                                                                      |
| 7.6 | Theme (light / dark)             | 🟡       | Auth-surface theming foundation landed (cookie-based light/dark/system + tokenized login/auth); authenticated shell rollout remains. |

---

## 8. Non-Functional Requirements & Crosscutting Concerns

| #    | Requirement                                     | Notes                                                                                                                                                                                                                |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1  | **PWA / Offline support**                       | App installable on desktop and mobile; timer state persisted locally via service worker / local storage                                                                                                              |
| 8.2  | **GDPR compliance**                             | Right to erasure (full account + data deletion), data export (JSON/CSV), no third-party data sharing                                                                                                                 |
| 8.3  | **Security (OWASP Top 10)**                     | Input validation, rate limiting, CSP headers, secure session cookies, HTTPS enforced                                                                                                                                 |
| 8.4  | **Internationalization (i18n)**                 | ✅ Implemented: `en`+`pl` day-one via `@nuxtjs/i18n`; cookie → `Accept-Language` → `en` resolution; `errors.*` messageKey contract; ESLint `no-raw-text` gate. Locale picker + user `locale` column deferred to 7.4. |
| 8.5  | **Accessibility (WCAG 2.1 AA)**                 | Keyboard navigation, screen reader support, sufficient color contrast (see `openspec/specs/accessibility/spec.md`)                                                                                                   |
| 8.6  | **Docker deployment**                           | Full stack deployable via `docker compose up`; no external SaaS dependencies                                                                                                                                         |
| 8.7  | **Data isolation between users**                | All queries scoped to the authenticated user; no cross-user data leakage possible                                                                                                                                    |
| 8.8  | **Audit / data integrity**                      | TimeEntry records are immutable after push (push status + remote ID stored); no silent data loss                                                                                                                     |
| 8.9  | **Responsive design**                           | Usable on desktop and tablet; mobile-friendly for quick timer start/stop                                                                                                                                             |
| 8.10 | **Accessibility runtime testing (axe-core)** 🟢 | Runtime a11y test gate via `vitest-axe` in the `nuxt` test project; deferred from `add-accessibility-standard` change                                                                                                |

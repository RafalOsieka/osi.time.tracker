# Design

## Context

See proposal.md (Why). Today README, `AGENTS.md`, `CODING_STANDARDS.md` and `docs/` overlap: setup and test commands appear in README and AGENTS, AGENTS summarizes the coding standards, and two specs plus `openspec/config.yaml` reference specific doc paths (`platform-dev-trackers` REQ-082, `platform-type-safety` REQ-243, `platform-ci` REQ-023, proposal rules naming `vision.md`/`wbs.md`/`user-stories.md`). The app is used by its author and possibly a few friends; there are no releases or tags.

## Goals / Non-Goals

**Goals:**
- Every topic has exactly one owning document; other documents link to it rather than repeat it.
- Self-hosting instructions are readable without running the app or reading developer material.
- `AGENTS.md` contains only what an agent needs to change code.

**Non-Goals:**
- Writing new prose beyond what the moved and rewritten files need.
- Changing the behavior any spec describes (deltas only change where a document lives).

## Decisions

### Document ownership map

```
file                       audience        owns
-------------------------  --------------  ------------------------------------------------
README.md                  anyone          what the app is, features, tech stack, links
ROADMAP.md                 anyone          planned features only
docs/self-hosting.md       operator        prod compose, secrets, upgrade notes, logs,
                                           VPN reachability, browser extension install
docs/development.md        human dev       prerequisites, .env, db, dev server,
                                           local trackers + seed + fixture, extension build
docs/coding-standards.md   human + agent   full coding rules (canonical)
docs/e2e-guideline.md      human + agent   e2e layout, runtimes, coverage, troubleshooting
AGENTS.md                  agent           commands agents run, short rule list, structure,
                                           workflow, domain glossary, constraints
openspec/                  human + agent   behavior (unchanged)
```

### AGENTS.md is for coding, not environment setup

Agents run lint, format, type-check, tests and `db:generate`; they do not bring up Docker or seed trackers. AGENTS keeps the commands agents run and points to `docs/development.md` for setup. Alternative considered: keep setup in AGENTS so an agent can bootstrap a fresh clone; rejected because the author sets up the environment and the content drifts when it lives in two places.

### Coding standards move to `docs/`, AGENTS keeps a short rule list

`docs/coding-standards.md` is canonical. AGENTS keeps about ten high-frequency rules (no `any`, `getDb()`, `messageKey` errors, i18n parity, Nuxt UI components, zod boundary types, etc.) and links to the full document, because agents load AGENTS automatically but often skip linked files. Alternative considered: merge the standards into AGENTS (one source, always loaded); rejected because AGENTS would grow to ~250 lines loaded in every session.

### README and AGENTS are rewritten with skills

README is generated with the `create-readme` skill and AGENTS with `create-agentsmd`, fed this ownership map, so neither inherits stale structure. The generated output is then trimmed to this map: README omits commands beyond a minimal quick start, AGENTS omits environment setup.

### Planning files are deleted, a minimal domain glossary survives

`vision.md`, `wbs.md` and `user-stories.md` are deleted without archiving; git history keeps them. The glossary terms agents need (Tracker, Project, Task derived from entry titles, TimeEntry, Remote Sync, rounding) and the hard architectural constraints (tracker API secrets never reach the server, all remote calls are on demand) go into AGENTS. Alternative considered: keep `vision.md` trimmed as a product document; rejected because nobody reads it before a change once `openspec/config.yaml` stops requiring it.

### ROADMAP content

```
Next          Client report: company tax ID (NIP) and contact details
              Long-running timer reminder
              "Nothing logged today" reminder
              Dashboard with charts (time per project/tracker over a period)
              User documentation
Browser extension   UI and feature development
Reports       Further expansion (direction to be decided)
Accounts      Self-registration, password reset, account deletion, 2FA, SSO
Later         More adapters (Jira, GitLab, ...)
              PWA (installable app, push notifications)
              Email notifications
```

No priorities, non-goals or IDs. Alternative considered: GitHub Issues; rejected for now as heavier than one list.

### e2e guideline structure

Reorganize into: overview (suites, runtimes, ownership), running locally vs CI (skip-build, `IS_E2E`), conventions, coverage, troubleshooting (symptom, cause, fix per entry), and known gaps (no live tracker e2e). Facts it references (warmup plugin, spec file names, scripts) are re-verified against the repo.

### `openspec/config.yaml`

The proposal rule naming the planning files becomes: check `ROADMAP.md` and existing specs to confirm the feature is in scope. The spec rule "Scope to MVP unless explicitly marked 🟡 V1.1 or later" becomes: scope requirements to what the proposal declares.

## Risks / Trade-offs

- [Skill output reintroduces duplication or stale facts] → Review the generated README and AGENTS against the ownership map and current code before committing.
- [Agents lose setup commands they occasionally need] → AGENTS links to `docs/development.md`.
- [Deleting `github-setup.md` loses the ruleset recipe] → The ruleset already exists in GitHub settings; REQ-406 still lists the required checks.
- [Links to moved files break] → Search the repo (excluding archived changes) for old paths after the moves.

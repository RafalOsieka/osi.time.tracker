# Behavior guideline

`docs/behavior/` describes how OSI Time Tracker behaves today, one file per **capability**. It is the source of truth for observable behavior. A spec issue (from `/to-spec`) plans a change; the capability file describes the result once that change ships.

## Reading and updating

- Before changing a feature, read the capability files it touches.
- A change to observable behavior updates its capability file in the same commit as the code. Behavior that is removed is deleted from the file; git history keeps it.

## What belongs here

**Observable behavior** only: what a user, an API client or the browser extension can see. The test: if the implementation could change without anyone outside the code noticing, it belongs elsewhere.

Write requirements in domain and HTTP terms, never in implementation terms: no library or framework names and versions, file paths, component, function or class names, CI job layout, build or tooling commands, and no scenarios like "type-check passes". Exceptions: a version that is an external contract (supported runtime, public API or protocol version, data format), and process guarantees written tool-agnostic.

The rest lives in:

- tooling, build, CI and test harness: `docs/development.md`, `docs/e2e-guideline.md`, `docs/coding-standards.md`;
- hard-to-reverse decisions and their reasons: `docs/adr/`;
- domain terms: the glossary (see `docs/agents/domain.md`).

## Files

- Name a file `<family>-<topic>.md`, flat in this directory. Families:
  - `platform-`: process guarantees others rely on (merge gates, the self-hosting delivery contract), written tool-agnostic;
  - `core-`: runtime cross-cutting foundations;
  - `ui-`: app-wide UI foundation and shell;
  - `workspace-`: local domain entities;
  - `tracking-`: time entries, timer, reports;
  - `remote-`: anything that talks to a tracker.

  Reuse a family whenever one fits; add a new one to this list only when none is a reasonable home.

- One surface or one contract per file. A file that outgrows that splits along its family prefix.
- Cross-cutting rules (authentication, CSRF, the error contract, per-user isolation, validation) live in `core-api-conventions`. Domain files reference it instead of restating them.
- Refer to another capability by its id in backticks (`core-api-conventions`), and to a requirement by its title.

## Format

```md
# <capability id>

## Purpose

One or two sentences on why the capability exists.

## Requirements

### Requirement: <Title>

One behavior in a short paragraph (at most ~500 characters), stated with SHALL.

#### Scenario: <Name>

- **WHEN** <trigger>
- **THEN** <outcome, stated with SHALL>
```

- One behavior per requirement. New behavior gets its own requirement and scenarios rather than a longer paragraph.
- Scenarios cover error and edge cases, not just the happy path.
- Write the current state as if it had always been so. Words that only make sense against history ("no longer", "new", "now", "as before", "unchanged") mark a sentence to rewrite.
- Requirement and scenario names describe current behavior; rename one when a change makes it wrong.

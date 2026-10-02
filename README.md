<div align="center">

<img src="./apps/web/public/icon.svg" alt="" width="72" height="72">

# OSI Time Tracker

**A self-hosted personal time tracker for IT consultants who log work across several clients' issue trackers.**

[![CI](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/RafalOsieka/osi.time.tracker/branch/main/graph/badge.svg)](https://codecov.io/gh/RafalOsieka/osi.time.tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Features](#features) · [Getting started](#getting-started) · [Documentation](#documentation)

</div>

Your clients each run their own tracker, OpenProject or Redmine, and each expects your hours there. OSI Time Tracker lets you track time once, in your own instance, and push it to the right tracker when you are ready, without re-entering anything. Each user has a fully isolated workspace; your data stays on your server.

## Features

- **Timer and manual entries:** start a timer from the top bar or add an entry after the fact. Type `@` in the title to pick a project.
- **Tasks without task management:** an entry's title _is_ its task. Tasks are created, matched, renamed, merged and cleaned up automatically from the titles you type.
- **Trackers and projects:** connect OpenProject and Redmine instances, then organize work into projects that belong to a tracker or stay local.
- **Remote sync:** review a day, link tasks to remote issues, apply rounding, and export the time logs in one action. Already-exported and directly-logged remote entries are shown side by side, and can be linked or deleted.
- **History import:** pull existing time logs from a tracker into local entries, mapped to your projects.
- **Reports:** a monthly timesheet comparing local hours with what landed on each tracker, and a per-client monthly PDF with saved presets.
- **Your secrets stay in your browser:** tracker API keys never reach the server. Requests go straight from the browser, or through an optional Chrome/Edge extension when the tracker is only reachable from your desktop or blocks cross-origin calls.
- **English and Polish**, light and dark themes, WCAG 2.1 AA as the accessibility target.

## Getting started

> [!NOTE]
> You need Docker with Compose v2 and a clone of this repository. Serve the app over HTTPS: the session cookie is `Secure` in production.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD, PGADMIN_DEFAULT_PASSWORD and a fresh NUXT_SESSION_PASSWORD,
# plus BOOTSTRAP_USER_EMAIL / BOOTSTRAP_USER_PASSWORD for your first login.
docker compose -f docker-compose.prod.yml up -d --build
```

The stack migrates the database, creates your user and serves the app on port `3000`. Then add your trackers on the **Trackers** page.

See [Self-hosting](./docs/self-hosting.md) for configuration, upgrades, the browser extension and troubleshooting, and [Development](./docs/development.md) to run it from source.

## Tech stack

| Area      | Technology                                                                           |
| --------- | ------------------------------------------------------------------------------------ |
| App       | Nuxt 4 (SSR), Vue 3, TypeScript, Nuxt UI 4 (Tailwind CSS 4, Lucide icons)            |
| API       | Nitro server routes, zod 4 for boundary types                                        |
| Database  | PostgreSQL 18 with Drizzle ORM                                                       |
| Security  | `nuxt-auth-utils` sealed cookie sessions, `nuxt-security` (CSRF, CSP, rate limiting) |
| Extension | Chrome/Edge Manifest V3, built with Vite                                             |
| Tooling   | pnpm, Vite+ (Vitest, Oxlint, Oxfmt), Playwright, Docker Compose                      |

## Project structure

```
apps/web/                     Nuxt application (UI, server API, shared types, tests)
apps/migrator/                SQL migrations and the one-shot runner that applies them
apps/extension/               Optional Chrome/Edge extension
apps/dev-seed/                Seeds local OpenProject/Redmine instances for development
packages/remote-trackers/     OpenProject and Redmine adapters behind a neutral contract
packages/extension-protocol/  Messages shared by the web app and the extension
docs/                         Self-hosting, development and contributor guides
openspec/                     Behavior specifications and change proposals
```

## Documentation

| Document                                       | What it covers                                             |
| ---------------------------------------------- | ---------------------------------------------------------- |
| [Self-hosting](./docs/self-hosting.md)         | Production stack, configuration, upgrades, extension, logs |
| [Development](./docs/development.md)           | Local environment, local trackers and fixture data         |
| [Coding standards](./docs/coding-standards.md) | Code style and conventions                                 |
| [E2E guideline](./docs/e2e-guideline.md)       | End-to-end test suites and troubleshooting                 |
| [Roadmap](./ROADMAP.md)                        | What is planned next                                       |
| [`openspec/specs`](./openspec/specs/)          | How every feature behaves, as specifications               |
| [`AGENTS.md`](./AGENTS.md)                     | Instructions for AI coding agents                          |

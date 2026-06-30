## Context

The repository is a public GitHub repo (`RafalOsieka/osi.time.tracker`, MIT) with no `.github/` directory and no CI. `package.json` already exposes the exact scripts the pipeline needs (`lint`, `format:check`, `type-check`, `test:unit`, `test:nuxt`, `test:e2e`, `build`). The package manager is pnpm `^11.6.0` with a committed `pnpm-lock.yaml` and a `pnpm-workspace.yaml` at the root. The e2e harness (`test/e2e/support/postgres.ts`) self-provisions `postgres:18-alpine` via `docker run`, needing only `NUXT_SESSION_PASSWORD` in the environment. The maintainer is solo, wants $0 cost, squash-only merges, and Conventional Commits enforced.

## Goals / Non-Goals

**Goals:**
- A verify-only PR pipeline that blocks broken/unformatted/untested/un-buildable code from reaching `main`.
- Fast feedback: trivial failures (lint/unit) short-circuit before the slow Dockerized e2e job runs.
- Enforce Conventional Commits on the squash-merge commit.
- Free dependency and security scanning with near-zero maintenance.
- Zero monetary cost.

**Non-Goals:**
- Deploy/release, image publishing, self-hosted runner, required reviews, merge queue, and changelog automation (all future proposals).

## Decisions

- **GitHub-hosted `ubuntu-latest` runner** over a self-hosted runner. Public repos get unlimited free minutes, and GitHub explicitly warns against self-hosted runners on public repos because fork PRs can execute untrusted code on the host. Docker (needed for e2e Postgres) is preinstalled on `ubuntu-latest`, so the self-hosted box offers no advantage here.
- **Parallel jobs** (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`) over one combined job. Granular jobs give a clearer PR checklist and faster wall-clock time; the extra per-job dependency installs are mitigated by pnpm store caching and are free on a public repo.
- **`e2e` gated via `needs:`** on all cheap jobs rather than running unconditionally. Docker + Postgres only spin up after cheap checks pass, shortening the feedback loop on trivial mistakes; confidence is unchanged because e2e still must pass to merge.
- **Conventional Commits enforced at the PR title** (via a PR-title-lint action) rather than linting every branch commit. Merges are squash-only, so the PR title becomes the landed commit on `main`; branch WIP commits stay unrestricted, which suits a solo workflow.
- **Merge enforcement via a GitHub branch ruleset on `main`**, delivered as a manual setup guide rather than a committed file. Rulesets/branch protection are not repo files, so the requirement is captured as documented manual UI steps.
- **CodeQL via default setup** (Security-tab toggle) over a committed advanced workflow, keeping the repo clean for a standard JS/TS app; documented as a manual one-click step.
- **`--frozen-lockfile` install + pnpm store cache keyed on `pnpm-lock.yaml`**, run from the repo root so the workspace resolves.

## Risks / Trade-offs

- [e2e flakiness under CI Docker] → Keep it gated and harden the suite if it flakes; the maintainer accepts ownership of stability.
- [Required-check names must match job names exactly, and a check is only selectable after running once] → The manual guide instructs: push the workflow, open a throwaway PR to let checks run, then pin them in the ruleset.
- [`pnpm-workspace.yaml` present could break installs run from a subdirectory] → All install/build steps run from the repo root; cache key is `pnpm-lock.yaml`.
- [Pinned action versions drift] → Dependabot's `github-actions` ecosystem keeps them current automatically.

# Tasks

## 1. Session cookie (backend)

- [x] 1.1 Add an assertion to `apps/web/test/e2e/api/auth.spec.ts` that the login `Set-Cookie` for the session carries `SameSite=Lax`, and verify it fails against the current `strict` setting (`pnpm test:e2e:api`).
- [x] 1.2 Set the session cookie to `sameSite: 'lax'` in `apps/web/nuxt.config.ts` and verify the test from 1.1 passes.

## 2. Health endpoint (backend)

- [x] 2.1 Add a `HealthDto` schema in `apps/web/shared/types`, `runtimeConfig.commitSha` defaulting to `dev`, and `apps/web/server/routes/healthz.get.ts` per REQ-529, with an `error` key for the unavailable database in the `en` and `pl` catalogs. Verify `pnpm type-check` and the i18n parity unit test pass.
- [x] 2.2 Add an API e2e spec for `GET /healthz` covering `200` without a session and `commit` reported as `dev`, and verify it passes (`pnpm test:e2e:api`).
- [x] 2.3 Add a unit test for the `503` path with a failing database, asserting a `messageKey` and no `commit`, and verify it passes (`pnpm test:unit`).
- [x] 2.4 Add the `COMMIT_SHA` build argument and `NUXT_COMMIT_SHA` to the `Dockerfile` runtime stage only, and verify with `docker build --target runtime --build-arg COMMIT_SHA=test` that the image environment holds the value.

## 3. Tab-return probe (frontend)

- [x] 3.1 Add the probe decision as a utility in `apps/web/app/utils` and unit test every REQ-533 scenario: redirect reloads, normal response and network failure do not, and repeated returns within a minute send one request. Verify with `pnpm test:unit`.
- [x] 3.2 Add the client-only plugin in `apps/web/app/plugins` that runs the utility on `visibilitychange` to visible, and verify `pnpm test:nuxt` passes and the page does not reload on tab return under `pnpm dev`.

## 4. Deployment template

- [x] 4.1 Add `deploy/osieka-dev/compose.yaml` with `db`, `migrate`, `app` (no published port, healthcheck on `/healthz`), `cloudflared` and the `backup` service per design, with only `MIGRATOR_IMAGE` and `APP_IMAGE` left for CI. Verify `docker compose config` succeeds with dummy values and refuses to run without the required secrets.
- [x] 4.2 Verify the `backup` service against a throwaway Compose project with its own volumes, never an existing stack: a dated dump appears, `pg_restore --list` reads it, and files older than 14 days are deleted.
- [x] 4.3 Add a `docker-compose` entry for `/deploy/osieka-dev` to `.github/dependabot.yml`, ignoring Postgres major updates because a new major cannot open the old volume, and verify the file parses as YAML.
- [x] 4.4 Write `deploy/osieka-dev/README.md` with the deploy flow, the variables and secrets, the edge and host setup, restoring a backup, and operating the instance, using placeholders only. Verify every variable in the template is listed and that it names no real address, credential or hosting detail.

## 5. Deploy workflow

- [x] 5.1 Add `workflow_dispatch` to `.github/workflows/ci.yml` and include the event name in the concurrency group, and verify from the file that a push to `main` cannot cancel a dispatch run.
- [x] 5.2 Add the `publish` job, limited to a dispatch on `main` and needing every gate: private-package check, image build and push, digest-pinned render, and one commit to `deploy` as `prod/compose.yaml`. Verify the job's `needs` list matches every gate, and that the render step produces the expected file when run locally with sample digests.
- [x] 5.3 Add the `verify-deploy` job per REQ-531, taking the URL and the access token from repository secrets only, and verify from the file that no step reads them from plain variables or echoes them.
- [x] 5.4 Describe the deploy workflow in `docs/development.md` under Continuous integration, and verify the required-checks text there still matches `ci.yml`.

## 6. Remove the production stack

- [x] 6.1 Move the tracker-access and browser-extension sections of `docs/self-hosting.md` to `docs/connecting-trackers.md`, then delete `docs/self-hosting.md` and `docker-compose.prod.yml`. Verify the new doc's links resolve.
- [x] 6.2 Remove the production section and references from `.env.example` and the comment in `docker-compose.yml`, and verify that copying the example still runs `pnpm dev` against the dev database.
- [x] 6.3 Update `README.md` (getting started, documentation table) and `AGENTS.md` (project structure, a hard constraint that deployment details stay out of the public repository), plus the `self-hosting.md` mention in both copies of the `compact-specs` skill. Verify `git grep` finds no remaining reference to the removed files outside archived changes.
- [x] 6.4 Add REQ-049, REQ-050, REQ-051, REQ-346 and REQ-354 to `docs/retired-requirements.md`, and rewrite the Purpose of `openspec/specs/platform-docker/spec.md` without the production stack. Verify `openspec validate --specs --strict` passes.

## 7. Integration checks

- [x] 7.1 Verify `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:e2e` all pass, and `openspec validate add-private-prod-deployment --strict` reports the change valid.

## Workflow follow-up

- Archive the change after review and merge.

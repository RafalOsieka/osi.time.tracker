# Design

## Context

See `proposal.md` for motivation. The host is a self-hosted Docker host reachable only by outbound connections. The sibling project Owe Yeah already delivers to such a host through a digest-pinned compose file on a `deploy` branch, which this change follows. The repository is public, so everything committed and every workflow log is public.

The access wall itself is configured at the edge and needs no application code. Setup at the edge and on the host is documented in `deploy/osieka-dev/README.md`, with placeholders only, and is not tracked here.

## Goals / Non-Goals

**Goals:**

- One manual action takes a verified `main` to production and confirms it landed.
- The host holds every runtime secret, and GitHub holds no credential that reaches the host.
- The app keeps working when the edge session lapses.

**Non-Goals:**

- A second environment or zero-downtime deploys. The app is down for the length of a migration.
- A rollback path across schema changes. Migrations stay forward-only, and the backups cover that case.

## Decisions

**Deploy with a manual GitHub workflow, a `deploy` branch and a polling stack.** `ci.yml` gains `workflow_dispatch`. On a dispatch from `main`, `publish` needs every gate, builds both Dockerfile targets, pushes them tagged by commit, renders `deploy/osieka-dev/compose.yaml` with only `MIGRATOR_IMAGE` and `APP_IMAGE` filled in, and commits it as `prod/compose.yaml` on `deploy`. The branch head is what runs, its history is the deploy log, and rolling back is reverting a commit. Alternatives: a button in the stack manager with CI committing on every green `main` (the branch would stop matching what runs), and a moving `latest` tag (no record, no pinning).

**Keep the dispatch out of the push concurrency group.** The group gains the event name. Otherwise a push to `main` would cancel a running deploy under the existing `cancel-in-progress`. Alternative: a separate workflow, which would duplicate or re-trigger every gate.

**Private GHCR packages.** The `publish` job refuses a package that is missing or publicly readable, as a package created by CI would inherit the public repository's visibility. Alternative: public images, which remove the pull credential but publish builds nobody else is meant to run.

**`verify-deploy` goes through the wall with a service token.** `curl` sends the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers. The URL and both token values are repository secrets, so GitHub masks them in public logs. The token passes the edge only, and the app login still stands behind it. Alternatives: a Bypass rule on `/healthz` (a hole in the wall), and a token scoped to a separate `/healthz` access application (tighter, but more setup and undocumented interaction with path precedence).

**`/healthz` lives outside `/api`.** It is a plain server route, returns a DTO from `shared/types`, runs `select 1` through `getDb()` and reads `runtimeConfig.commitSha`. The runtime stage alone takes the `COMMIT_SHA` build argument and sets `NUXT_COMMIT_SHA`, so a new commit does not invalidate the build cache. The compose healthcheck uses it too.

**`SameSite=Lax`.** REQ-006 already requires it, and the code drifted to `strict`. `Lax` adds the cookie only on top-level GET navigations, and the CSRF token still protects mutations.

**Tab-return probe.** A client-only plugin listens for `visibilitychange`, requests `/api/auth/session` with `redirect: 'manual'`, and reloads when `response.type === 'opaqueredirect'`. The decision lives in a small utility so it can be unit tested. Without a wall the response is never a redirect, so it does nothing. Alternatives: `X-Requested-With` plus global 401 handling (touches every fetch path, and the app has no central client), and very long edge sessions alone (still fails silently, only less often).

**Backups as a compose service.** A `backup` service on the Postgres image loops once a day: `pg_dump -Fc` to a temporary name, an atomic rename to a dated file in its own volume, then deletion of files older than 14 days. A failed dump is logged and the loop continues. It writes only to its own volume. Alternatives: cron on the host (the host carries no deploy scripts), and no backups (the database is the only copy of exact times and unexported hours).

**Move tracker-access and extension instructions to `docs/connecting-trackers.md`.** They stay true for any instance, unlike the rest of `docs/self-hosting.md`.

## Risks / Trade-offs

- Service token rejected by the tunnel's JWT check -> `verify-deploy` fails visibly after 15 minutes, and the deploy itself is unaffected.
- A tab open at the exact moment the edge session lapses still fails silently until the next return to the tab -> the edge session length makes this rare, and a reload fixes it.
- A reload on return discards an open form -> only happens when any save would have failed anyway.
- Backups live on the same host -> they cover bad migrations and accidental deletion, not loss of the machine.
- An image that fails to build is found only at deploy time -> `publish` stops before committing, so production is untouched.
- Removing the compose file breaks `compose -f` for an existing local stack -> its containers and volumes are untouched and remain reachable by container name.

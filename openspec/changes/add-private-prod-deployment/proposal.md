# Proposal

## Why

OSI Time Tracker needs one private production instance that is reachable from anywhere but only by allowed people. The repository has no delivery pipeline, and its root production compose exists for self-hosters the project no longer supports.

## What Changes

- Add a deployment template under `deploy/osieka-dev/`: PostgreSQL, the one-shot migrator, the app, a Cloudflare Tunnel connector and a daily database backup. The app publishes no port.
- Add a manual GitHub deploy: it runs every quality gate on `main`, pushes private GHCR images, commits a digest-pinned compose file to a `deploy` branch, then waits until production reports the deployed commit.
- Add `GET /healthz`, reporting database health and the running commit.
- Fix the session cookie to the `SameSite=Lax` that `core-authentication` REQ-006 already requires. `Strict` drops the session on the navigation back from an external login page.
- Reload an open tab on return when the access layer in front of the app has expired, so later actions do not fail silently.
- **BREAKING** Remove `docker-compose.prod.yml` and the self-hosting guide. Anyone else running the app builds it from the `Dockerfile` and writes their own setup. The tracker-access and browser-extension instructions move to their own doc.
- Keep the production address and host details out of the repository and public workflow logs.

## Non-goals

- Changing how users log in to the app, or adding registration.
- Privacy or terms pages.
- Automatic deploys on merge.
- Off-host backup copies.
- Performing the Cloudflare or host setup, or moving existing data. Those happen outside this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-docker`: drops the production compose stack requirements, narrows the environment example to development, adds the health endpoint.
- `platform-ci`: adds the guarantees for explicit, gated, verified production deploys and for keeping deployment details private.
- `core-authentication`: adds the reload on returning to a tab whose access layer has expired.

## Impact

- **App:** `nuxt.config.ts` session cookie, a new server route, a client plugin, runtime config, i18n catalogs.
- **Build and CI:** `Dockerfile` commit build argument, `.github/workflows/ci.yml`, `.github/dependabot.yml`.
- **Removed:** `docker-compose.prod.yml`, `docs/self-hosting.md`.
- **Docs:** `README.md`, `AGENTS.md`, `.env.example`, `docs/development.md`, `docs/retired-requirements.md`, a new tracker-access doc, a new `deploy/osieka-dev/README.md`.
- **External:** requires private GHCR packages and repository secrets for the production URL and access token.

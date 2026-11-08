# OSI Time Tracker on osieka.dev

These files are built for one private instance: OSI Time Tracker run by osieka.dev, behind Cloudflare Access and Cloudflare Tunnel, from GHCR images, on a self-hosted Docker host reachable only by outbound connections. They are not a supported way to run the app. To run your own, build the images from the [`Dockerfile`](../../Dockerfile) and write your own stack.

The instance's real address, Access settings and host details never go in this repository. `<prod-host>` below stands for the address.

## How a build reaches production

1. Merging to `main` runs CI and deploys nothing.
2. In **Actions → PR CI → Run workflow**, on `main`, start a deploy. It runs every gate again. Once all are green, `publish` pushes `ghcr.io/rafalosieka/osi-time-tracker` (the app) and `ghcr.io/rafalosieka/osi-time-tracker-migrator`, tagged by commit SHA.
3. `publish` renders [`compose.yaml`](compose.yaml) with both images pinned by digest. `MIGRATOR_IMAGE` and `APP_IMAGE` are the only variables it fills in, and it fails if anything else changed. It commits the result to the `deploy` branch as `prod/compose.yaml`, one `Deploy <commit> to prod` commit per deploy.
4. The host's stack polls `deploy` every ~5 minutes and redeploys on a change: `db`, then `migrate` to completion, then `app`, with `backup` and `cloudflared` alongside.
5. `verify-deploy` polls `/healthz` through the Access wall every 30 seconds until it reports the new commit, or fails the run after ~15 minutes.

## Setting up the instance

Do these in order, so the app is never reachable without the wall.

1. **Tunnel.** In Cloudflare Zero Trust, create a remotely-managed tunnel and copy its token. Add no public hostname yet.
2. **Stack secrets**, as the stack's environment variables on the host, never in Git or GitHub:

   | Variable                                                  | Required | Purpose                                                                                                  |
   | --------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
   | `POSTGRES_PASSWORD`                                       | yes      | Database password. URL-safe (no `@`, `/`, `:`).                                                          |
   | `NUXT_APP_SECRET`                                         | yes      | 32+ characters; seals the session cookie. Changing it ends every session.                                |
   | `TUNNEL_TOKEN`                                            | yes      | The tunnel's token.                                                                                      |
   | `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD`        | no       | The migrator creates this user if it doesn't exist yet. Changing them and redeploying adds another user. |
   | `BOOTSTRAP_USER_DISPLAY_NAME` / `BOOTSTRAP_USER_TIMEZONE` | no       | Profile of that user. Default to the email local part and `UTC`.                                         |
   | `CONSOLA_LEVEL`                                           | no       | Server log verbosity, `3` by default. `4` also logs every SQL statement.                                 |

   The stack refuses to start without the required three.

3. **Packages**, once, before the first deploy. A package CI creates would take the repository's visibility, public from its first push, so create both by hand:
   1. Build both `Dockerfile` targets (`runtime`, `migrator`) from `main` and push them, tagged by commit SHA, to the two repositories above from your machine, logged in to `ghcr.io` with a classic token with `write:packages`. A package pushed this way starts private.
   2. In each package's settings, untick **Inherit access from repository**, give this repository the **Write** role under **Manage Actions access**, and invite the bot account (below) with the **Read** role.

   `publish` refuses to push to a package it can't read or that anyone can pull.

4. **Registry credential.** The host pulls as a bot GitHub account that can read only private deployment packages. Give the stack a registry credential for `ghcr.io`: the bot's username and a classic token with only `read:packages`.
5. **Stack.** Create a stack from this repository, branch `deploy`, file `prod/compose.yaml`, polling every ~5 minutes. Redeploying it by hand is the fallback. The branch appears with the first deploy, so start one from Actions before this step. Its `verify-deploy` fails until step 11 is done, which is expected.
6. Check that `cloudflared` and `app` turn healthy.
7. **Access application**, before any hostname exists. In Zero Trust, **Access controls → Applications → Add**, type Self-hosted, for `<prod-host>`:
   - An **Allow** policy listing the allowed email addresses, with one-time PIN as the login method.
   - A **Service Auth** policy with a new service token for the deploy check. Save the token's client id and secret once, for step 11.
   - Application session and the organization's global session set to one week, the app's own session length. A session that lapses in an open tab makes API calls fail until a reload, and the app only reloads by itself when you return to the tab.
8. **Public hostname** on the tunnel: `<prod-host>` → `http://app:3000`. On that route, turn on **Enforce Access JWT validation** with the team name and the Access application's AUD tag, so `cloudflared` refuses traffic if the application is ever removed.
9. **Configuration Rule** for that hostname: Rocket Loader, Email Obfuscation and RUM (Web Analytics) injection off. The app's CSP blocks any script Cloudflare injects.
10. **Redirect Rule** for that hostname: HTTP to HTTPS. The session cookie is `Secure`.
11. **GitHub repository secrets**: `PROD_URL` (`https://<prod-host>`), `PROD_ACCESS_CLIENT_ID` and `PROD_ACCESS_CLIENT_SECRET`. All three must be secrets, not variables: secrets are masked in this public repository's workflow logs.

Each browser then needs its tracker API keys entered once and, where used, the extension approved for the address. See [Connecting trackers](../../docs/connecting-trackers.md).

## What the app relies on Cloudflare for

- **Being the only way in.** The app publishes no port, and only the tunnel reaches it.
- **Rate limiting by client.** The limiter keys on the first `X-Forwarded-For` entry, which a client can forge. Only people past the wall can reach it, so this is accepted here.

## Operating production

- **Did the deploy land?** A failed `verify-deploy` job emails, as any failed run does. If `publish` passed but production still runs the old commit, look at the host's pulls first: once the bot's token expires, they fail as unauthorized.
- **Logs:** the containers' logs on the host, rotated at 10 MB × 3 per container. To see more, set `CONSOLA_LEVEL=4` on the stack and restart `app`.
- **Rollback:** revert the latest commit on `deploy`; the stack picks it up at its next poll. Migrations only go forward, so an older build can break on a newer schema. In that case restore the backup from before the deploy, or fix forward.
- **Downtime:** the app is down for the length of a deploy's migration, and a failed migration keeps it down until the next good deploy.

## Backups

`backup` writes `osi-time-tracker-<date>.dump` to its own volume when it starts and every 24 hours after, keeping 14 days. A failed dump is logged and retried at the next run. The dumps are on the same host as the database, so they cover a bad migration or an accidental deletion, not the loss of the machine.

To restore one, stop `app`, replace the database, then redeploy so `migrate` applies anything newer:

```sh
docker exec <backup container> ls /backups
docker exec <db container> psql -U postgres -d postgres -c 'DROP DATABASE osi_time_tracker WITH (FORCE)' -c 'CREATE DATABASE osi_time_tracker'
docker exec <backup container> pg_restore --no-owner --no-acl --dbname osi_time_tracker /backups/<file>.dump
```

Restore into an empty database, never over existing tables: the dump carries its own migration history, and an older history over a newer schema makes `migrate` fail.

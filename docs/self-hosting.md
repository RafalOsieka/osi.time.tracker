# Self-hosting

OSI Time Tracker runs as a self-contained Docker Compose stack: PostgreSQL 18, a one-shot migrator, the web app and pgAdmin. Your remote trackers (OpenProject, Redmine) are your own instances; the stack does not include them.

## Requirements

- Docker with Compose v2.
- A clone of this repository (the stack builds its images from source).
- HTTPS in front of the app. The session cookie is `Secure` in production builds, so browsers only keep it over HTTPS (or on `http://localhost`). Put the app behind a reverse proxy that terminates TLS.

## Configure

All configuration lives in one `.env` file next to the compose file.

```bash
cp .env.example .env
```

Then edit `.env`:

1. In the **Production compose** section, uncomment and set `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` (e.g. `openssl rand -base64 32`).
2. Replace `NUXT_SESSION_PASSWORD` with a fresh secret of 32+ characters. The value in `.env.example` is for development only.
3. Set `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` to the account you will log in with. Optionally set `BOOTSTRAP_USER_DISPLAY_NAME` and `BOOTSTRAP_USER_TIMEZONE` (an IANA id such as `Europe/Warsaw`); both can be changed later on the Profile page.

| Variable                                                  | Required | Default                        | Purpose                                                                    |
| --------------------------------------------------------- | -------- | ------------------------------ | -------------------------------------------------------------------------- |
| `NUXT_SESSION_PASSWORD`                                   | yes      | —                              | Seals the session cookie (32+ characters).                                 |
| `POSTGRES_PASSWORD`                                       | yes      | —                              | Database password.                                                         |
| `PGADMIN_DEFAULT_PASSWORD`                                | yes      | —                              | pgAdmin login password.                                                    |
| `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD`        | no       | —                              | The migrator creates this user if it does not exist yet.                   |
| `BOOTSTRAP_USER_DISPLAY_NAME` / `BOOTSTRAP_USER_TIMEZONE` | no       | email local part, `UTC`        | Profile of the bootstrap user. An invalid timezone fails the migrate step. |
| `POSTGRES_USER` / `POSTGRES_DB`                           | no       | `postgres`, `osi_time_tracker` | Database name and user.                                                    |
| `PORT`                                                    | no       | `3000`                         | Published app port.                                                        |
| `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_PORT`                  | no       | `admin@example.com`, `8080`    | pgAdmin login email and published port.                                    |
| `CONSOLA_LEVEL`                                           | no       | `3`                            | Server log verbosity, see [Troubleshooting](#troubleshooting).             |

The stack refuses to start while any required variable is missing. Never commit `.env`.

## Run

```bash
docker compose -f docker-compose.prod.yml up -d --build   # build, migrate, start
docker compose -f docker-compose.prod.yml down            # stop (keeps data)
docker compose -f docker-compose.prod.yml down -v         # stop and DELETE all data
```

On every start the `migrate` service applies pending database migrations and seeds the bootstrap user, then exits; the `app` service starts only after it succeeds. The app is published on `PORT`, pgAdmin on `PGADMIN_PORT`; the database port is not published.

Log in with the bootstrap user, then add your trackers on the **Trackers** page.

## Upgrade

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically before the new app starts. Read the release-specific notes below before upgrading across them.

### Release notes that need action

- **Profile page:** every user now has a required display name and timezone. The migration fills missing values with the email local part and `UTC`, so set your timezone once on the Profile page (account menu in the sidebar footer). Existing sessions end with the upgrade; log in again.
- **From `docker-compose.standalone.yml`:** the stack now uses the fixed project name `osi-time-tracker-prod`, so its volumes are `osi-time-tracker-prod_pg-osi-time-tracker-standalone` and `osi-time-tracker-prod_pgadmin-osi-time-tracker-standalone`. Your existing data lives under `<clone-directory>_pg-osi-time-tracker-standalone`; copy it across once before the first `up`:

  ```bash
  docker run --rm -v OLD:/from -v NEW:/to alpine cp -a /from/. /to/
  ```

## Reaching your trackers

The OSI server never contacts your trackers. Every tracker request is made by **your browser**, either directly or through the browser extension, using an API key that is stored only in that browser. This means:

- The device you use OSI on must reach the tracker, publicly or over VPN. If a tracker is only on a VPN, connect that device to the VPN.
- **Direct browser access** additionally requires the tracker to allow cross-origin requests from the OSI origin (CORS).
- When CORS blocks direct access, turn off **Direct browser connection allowed** for that tracker and use the browser extension instead. There is no automatic fallback.

## Browser extension (Chrome / Edge)

The extension is not part of the Docker image; each person builds and loads it locally from a clone of the repository (Node.js and pnpm required, see [`development.md`](./development.md#prerequisites)).

```bash
pnpm install
pnpm build:packages
pnpm --filter @osi/extension build
```

1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked** and select `apps/extension/dist`.
2. Open OSI, click the extension's toolbar icon and choose **Approve in setup** to approve that website (or enter its origin, e.g. `https://time.example.com`, on the setup page). HTTP destinations show a credential-risk warning.
3. In OSI, turn off **Direct browser connection allowed** on the trackers that should go through the extension, then refresh the OSI tab.
4. Approve each tracker. Either enter its base URL on the setup page, or open the extension status in the OSI sidebar and choose **Request approval in extension** next to the tracker: the request appears in the extension (the toolbar icon shows a count), and you approve or dismiss it there.

The setup page shows each tracker's latest request (time, operation and outcome) for the current browser session, which helps when a sync fails.

The web app and the extension must come from the same version of the repository: after updating OSI, rebuild the extension, click **Reload** on the extension card and refresh the OSI tab. If OSI reports an incompatible extension, rebuild and reload it. Workplace policies that block unpacked extensions or host permissions cannot be bypassed.

API keys stay in the website's `localStorage` and are passed to the extension only for the current request; the extension never stores them. To stop using the extension, turn **Direct browser connection allowed** back on (if the tracker allows CORS) and remove the extension. Local time entries are unaffected.

## Troubleshooting

Every failing request is logged as one line, with the response's `messageKey` when there is one:

```bash
docker compose -f docker-compose.prod.yml logs -f app
# [POST] /api/trackers/.../import -> 422 error.remoteLogImportProjectNotBound
```

Successful requests are not logged, so the log stays quiet in normal operation.

For more detail, including every SQL statement, set `CONSOLA_LEVEL=4` in `.env` and restart only the app (no rebuild or migration needed):

```bash
docker compose -f docker-compose.prod.yml up -d app
```

Set it back to `3` (or remove it) and restart `app` again to return to normal verbosity.

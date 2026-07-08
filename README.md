# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Testing

### Unit tests

No external dependencies required:

```bash
pnpm test:unit
```

### Nuxt component / integration tests

No external dependencies required:

```bash
pnpm test:nuxt
```

### E2E tests

E2E tests have two tiers with different requirements:

#### API / server e2e (no browser)

Requires **Docker** with the `postgres:18-alpine` image available. The test harness spins up a disposable PostgreSQL container automatically on port `54329`.

```bash
# Ensure Docker is running, then:
pnpm test:e2e
```

If Docker is not available, all API e2e suites are skipped automatically.

#### Browser / UI e2e (Playwright)

Requires **Docker** (see above) **and** Playwright browser binaries installed:

```bash
# Install Playwright browsers (one-time setup)
pnpm exec playwright install chromium

# Then run e2e tests as usual
pnpm test:e2e
```

If Playwright browser binaries are not installed, the browser-based suites (`auth-ui`, `i18n-login`, `shell`) are skipped automatically.

#### Execution modes

By default, the E2E harness performs a one-time production build (`pnpm build`) during global setup and runs tests against this build for maximum performance and parity with production.

To run tests against the development server (useful for faster iteration without rebuilding), use the `NUXT_TEST_DEV` environment variable:

```bash
# Unix/macOS
NUXT_TEST_DEV=1 pnpm test:e2e

# Windows (PowerShell)
$env:NUXT_TEST_DEV=1; pnpm test:e2e
```

When `NUXT_TEST_DEV` is set, the global build step is skipped and each test worker starts a Nuxt dev server.

---

## Docker — Production Image

The repository ships a multi-stage `Dockerfile` that produces a slim production image containing only the Nitro server output (`.output/`) and a Node 24 runtime.

### Runtime decisions

- **Non-root user**: the container runs as the unprivileged `node` user — never as root.
- **Fixed `NODE_ENV=production`**: baked into the image; production behaviour is invariant.
- **Fixed port**: the container listens on port `3000` (the Nitro default). The host-side port mapping can be changed via the `PORT` variable in the compose file.
- **No baked secrets**: `DATABASE_URL` and `NUXT_SESSION_PASSWORD` must be supplied at container start via environment variables.
- **`HEALTHCHECK` deferred**: intentionally omitted from this image; will be added in a future change.

### Local production verification

Use `docker-compose.local-prod.yml` to build and run the production image locally against the existing dev database stack.

**Required environment variables** (set in `.env` or export before running):

| Variable                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string for the **in-container** connection. Must NOT use `localhost` — inside a container `localhost` refers to the container itself. Use the Docker service name `db` when the database runs in the same compose network (e.g. `postgres://postgres:postgres@db:5432/osi_time_tracker`), or `host.docker.internal` when the database runs on the host machine (e.g. `postgres://postgres:postgres@host.docker.internal:5432/osi_time_tracker`). Defaults to the `@db:5432` form if unset. |
| `NUXT_SESSION_PASSWORD` | 32+ character secret for sealing session cookies                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Startup order** — the DB compose must be running before the prod compose, because the prod compose joins the `osi-time-tracker` network as external:

```bash
# 1. Start the database (creates the osi-time-tracker network)
docker compose up -d

# 2. Build the production image, run migrations, then start the app
docker compose -f docker-compose.local-prod.yml up --build
```

The `migrate` service runs `pnpm db:migrate` once and exits. The `app` service starts only after `migrate` exits with status 0. If migrations fail, the app is never started.

To stop the production stack:

```bash
docker compose -f docker-compose.local-prod.yml down
```

## Daily use (standalone stack)

The repository provides a single-command standalone deployment stack (`docker-compose.standalone.yml`) designed for daily personal use. It runs the entire application—the PostgreSQL 18 database, the database migrator/seeder, and the Nuxt web application—fully contained within its own isolated environment.

### Prerequisites

- **Docker** and **Docker Compose** installed on your system.

### .env Setup

The standalone stack requires `NUXT_SESSION_PASSWORD` to be present in your environment. You can set this by creating a `.env` file in the project's root directory:

```env
# Secret used by nuxt-auth-utils to seal session cookies.
# MUST be a secure, random string of 32+ characters.
NUXT_SESSION_PASSWORD=your-secure-32-plus-character-secret-key-here
```

_Note: You do not need to set `DATABASE_URL` in your `.env` for the standalone stack, as it connects to the database service internally. If you are a developer, any `DATABASE_URL` set in your dev `.env` file will be safely ignored by the standalone stack._

### Commands

**Start the stack:**
This builds the images, waits for the database to become healthy, automatically applies any pending schema migrations and seeds the bootstrap user (if configured), and starts the web application on port `3000` (or the port specified in your `PORT` environment variable).

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

**Stop the stack (with data retention):**
Stops and removes the containers while preserving all your database logs, time entries, and users inside the dedicated named volume `pg-osi-time-tracker-standalone`.

```bash
docker compose -f docker-compose.standalone.yml down
```

**Stop and delete all data (destructive):**
Stops the containers and permanently deletes the named volume, destroying all stored users, clients, tasks, and time entries.

```bash
docker compose -f docker-compose.standalone.yml down -v
```

### Upgrade Flow

To upgrade your standalone installation to the latest version while keeping your data fully intact:

```bash
# 1. Pull the latest code changes
git pull

# 2. Rebuild and start the containers (data is safely retained in the named volume)
docker compose -f docker-compose.standalone.yml up -d --build
```

## Database

The application uses [Drizzle ORM](https://orm.drizzle.team/) with the `postgres` driver against a PostgreSQL database.

> **Requirement:** Requires **PostgreSQL >= 18** (for native `uuidv7()` support used for primary keys).

### Configuration

Set the `DATABASE_URL` environment variable to a PostgreSQL connection string (see `.env.example`):

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/osi_time_tracker
```

The server-side Drizzle client (`server/db`) and the migration tooling both read `DATABASE_URL`. If it is missing, client initialization and migrations fail fast with a clear error rather than connecting to a default.

### Run the database (Docker Compose)

A repo-root `docker-compose.yml` starts a local PostgreSQL (`postgres:18-alpine`) instance matching the default `DATABASE_URL`:

```bash
# Start the database in the background
docker compose up -d

# Apply pending migrations against the running container
pnpm db:migrate

# Stop the container (data is kept)
docker compose down

# Stop and DELETE the data volume (destroys all data)
docker compose down -v
```

Data is stored in a persistent named volume (`pgdata`), so it survives `docker compose down` and container recreation — it is only removed with `docker compose down -v`. Credentials and the host port can be overridden via env vars (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`; see `.env.example`), which Compose auto-loads from a root `.env` file. The compose service and the e2e test harness share the same `postgres:18-alpine` image.

### Migrations

Schema changes are expressed as committed SQL migration files under `server/db/migrations`:

```bash
# Generate a new SQL migration after editing the schema
pnpm db:generate

# Apply all pending migrations to the database in DATABASE_URL
pnpm db:migrate
```

Migrations are generated by `drizzle-kit` and applied by the `drizzle-orm` migrator, which records applied migrations so they are not re-run.

### Unattended migrations (Docker Compose)

The production compose stack (`docker-compose.local-prod.yml`) runs a dedicated one-shot `migrate` container that executes `pnpm db:migrate` to completion **before** the application begins serving traffic. If a migration fails, the container exits non-zero and the `app` service is never started.

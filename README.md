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

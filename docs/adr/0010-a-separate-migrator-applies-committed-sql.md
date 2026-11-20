# A separate migrator applies committed SQL

Schema changes are SQL migration files generated from the Drizzle schema and committed to `apps/migrator`. A separate one-shot migrator image applies them, and seeds the bootstrap user with plain SQL, before the app starts serving traffic. The app itself never migrates.

Migrating when the app boots was rejected: it ties migrations to the process that serves requests and, with several app instances, risks serving a partly migrated database. A separate step halts startup when a migration fails. `drizzle-kit push` was rejected because it changes the database without a reviewable, repeatable file. A shared `packages/db` was rejected because it would move every schema import for no runtime gain.

## Consequences

- The committed SQL files, not the Drizzle schema, are the contract with the database; the migrator does not import the app's schema.
- A deployment runs the migrator first and starts the app only after it succeeds.

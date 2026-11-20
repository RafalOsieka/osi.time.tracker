# PostgreSQL 18 for native UUIDv7

PostgreSQL 18 is the minimum version, so every primary key can default to the database's own `uuidv7()`. The ids are time-ordered, which keeps indexes local, and every insert gets one, including raw SQL in migrations and seeds, with no extra dependency.

Rejected: generating UUIDv7 in the app (raw SQL inserts would miss it), the `pg_uuidv7` extension (one more thing to install on every database) and serial integers (guessable and sequence-bound).

## Consequences

- An installation cannot run on an older PostgreSQL.

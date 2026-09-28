import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

config({ path: resolve(fileURLToPath(new URL('../..', import.meta.url)), '.env') });

// Reads DATABASE_URL from the environment (load via dotenv when running scripts).
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Define it (see .env.example) before running drizzle-kit.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/*.ts',
  // The schema lives here, but the committed migrations belong to the migrator app,
  // which ships them in its Docker image and applies them (`pnpm db:migrate`).
  out: '../migrator/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
});

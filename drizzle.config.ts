import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from the environment (load via dotenv when running scripts).
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Define it (see .env.example) before running drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/*.ts",
  out: "./server/db/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
});

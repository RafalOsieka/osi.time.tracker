import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Fixed dev-only keys. They match the compose entrypoint (Redmine) and the
 * token the seed installs (OpenProject); `.env.example` ships the same values.
 */
export const DEFAULT_REDMINE_DEV_API_KEY = 'd3adbeefd3adbeefd3adbeefd3adbeefd3adbeef';
export const DEFAULT_OPENPROJECT_DEV_API_KEY = `opapi-${'d3adbeef'.repeat(8)}`;

const seedEnvSchema = z.object({
  OPENPROJECT_PORT: z.coerce.number().int().positive().default(8090),
  REDMINE_PORT: z.coerce.number().int().positive().default(8091),
  OPENPROJECT_DEV_API_KEY: z.string().trim().min(1).default(DEFAULT_OPENPROJECT_DEV_API_KEY),
  REDMINE_DEV_API_KEY: z.string().trim().min(1).default(DEFAULT_REDMINE_DEV_API_KEY),
  REDMINE_ADMIN_PASSWORD: z.string().min(1).default('admin'),
});

/** Everything the seed needs from the environment, with compose defaults applied. */
export interface SeedEnv {
  openProject: { baseUrl: string; apiKey: string };
  redmine: { baseUrl: string; apiKey: string; adminPassword: string };
}

/**
 * Minimal dotenv reader: `KEY=value` lines, `#` comments, optional single or
 * double quotes around the value. Enough for the repo's `.env`; no expansion.
 */
export function parseDotEnv(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) {
      value = quoted[2] ?? '';
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    entries.set(key, value);
  }
  return entries;
}

/**
 * Resolves the seed configuration the way compose does: shell environment wins
 * over `.env`, and `.env` wins over the built-in defaults.
 */
export function resolveSeedEnv(dotEnvText: string | null, shellEnv: NodeJS.ProcessEnv): SeedEnv {
  const fromFile = dotEnvText === null ? new Map<string, string>() : parseDotEnv(dotEnvText);
  const merged: Record<string, string> = {};
  for (const key of seedEnvSchema.keyof().options) {
    const value = shellEnv[key] ?? fromFile.get(key);
    if (value !== undefined && value !== '') merged[key] = value;
  }
  const env = seedEnvSchema.parse(merged);
  return {
    openProject: {
      baseUrl: `http://localhost:${env.OPENPROJECT_PORT}`,
      apiKey: env.OPENPROJECT_DEV_API_KEY,
    },
    redmine: {
      baseUrl: `http://localhost:${env.REDMINE_PORT}`,
      apiKey: env.REDMINE_DEV_API_KEY,
      adminPassword: env.REDMINE_ADMIN_PASSWORD,
    },
  };
}

/** Reads `<repoRoot>/.env` when present; a missing file just means defaults. */
export function readDotEnvFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

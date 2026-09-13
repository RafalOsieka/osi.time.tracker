import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { RedmineAdapter, redmineAuthHeaders } from '@osi/remote-trackers/redmine';
import { createComposeRunner } from './docker.js';
import { readDotEnvFile, resolveSeedEnv } from './env.js';
import { CLIENT_FIXTURES, HELIOS, NORDWIND } from './fixture/index.js';
import { formatIsoDate } from './generator/calendar.js';
import { generateLogs } from './generator/logs.js';
import { waitForTrackers } from './health.js';
import { createJsonHttp } from './http.js';
import { ensureOpenProjectToken } from './openproject/bootstrap.js';
import { createOpenProjectSeeder } from './openproject/seeder.js';
import { createRedmineSeeder } from './redmine/seeder.js';
import { runSeed } from './seed.js';
import { createFetchTransport, type TransportDiagnostics } from './transport.js';

const USAGE = `Usage: pnpm trackers:seed [--dry-run] [--reset] [--help]

Seeds the local OpenProject and Redmine instances started by
\`docker compose --profile trackers up -d\` with the Nordwind / Helios fixture
(projects, issues, three months of time logs) and prints the dev API keys.

  --dry-run   print the plan without writing to either tracker
  --reset     delete fixture time logs first, then re-seed
  --help      show this help
`;

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const HEALTH_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

export async function main(argv: string[]): Promise<number> {
  const known = new Set(['--dry-run', '--reset', '--help']);
  const unknown = argv.filter((arg) => !known.has(arg));
  if (argv.includes('--help') || unknown.length > 0) {
    process.stdout.write(
      unknown.length > 0 ? `Unknown option: ${unknown.join(' ')}\n\n${USAGE}` : USAGE,
    );
    return unknown.length > 0 ? 1 : 0;
  }
  const options = { dryRun: argv.includes('--dry-run'), reset: argv.includes('--reset') };

  const env = resolveSeedEnv(readDotEnvFile(resolve(REPO_ROOT, '.env')), process.env);
  const compose = createComposeRunner(REPO_ROOT);
  const diagnostics: TransportDiagnostics = { lastErrorBody: null };
  const transport = createFetchTransport(fetch, diagnostics);

  const redmineAdapter = new RedmineAdapter(transport, env.redmine.baseUrl, env.redmine.apiKey);
  const openProjectAdapter = new OpenProjectAdapter(
    transport,
    env.openProject.baseUrl,
    env.openProject.apiKey,
  );
  const openProjectAuth = {
    Authorization: `Basic ${Buffer.from(`apikey:${env.openProject.apiKey}`).toString('base64')}`,
  };

  const report = (line: string) => {
    process.stdout.write(`${line}\n`);
  };

  const outcome = await runSeed(options, {
    env,
    runDate: formatIsoDate(Date.now()),
    fixtures: CLIENT_FIXTURES,
    generateLogs,
    report,
    waitForTrackers: async () => {
      report('waiting for the tracker healthchecks…');
      await waitForTrackers(async () => (await compose(['ps', '--format', 'json'])).stdout, {
        timeoutMs: HEALTH_TIMEOUT_MS,
        pollMs: 5000,
        sleep,
        now: Date.now,
      });
    },
    bootstrap: {
      redmine: async () => {
        try {
          const account = await redmineAdapter.getCurrentAccount();
          return `API key authenticates as ${account.name}`;
        } catch (err) {
          throw new Error(
            'bootstrap: REDMINE_DEV_API_KEY does not authenticate. The entrypoint installs it on boot; ' +
              'recreate the container with `docker compose --profile trackers up -d --force-recreate redmine` ' +
              `(${err instanceof Error ? err.message : String(err)})`,
            { cause: err },
          );
        }
      },
      openproject: async () => {
        const probe = async () => {
          try {
            await openProjectAdapter.getCurrentAccount();
            return true;
          } catch {
            return false;
          }
        };
        const result = await ensureOpenProjectToken(env.openProject.apiKey, { probe, compose });
        return result === 'installed'
          ? 'installed the dev API token for admin (rails runner)'
          : 'API key authenticates';
      },
    },
    seeders: {
      redmine: createRedmineSeeder({
        http: createJsonHttp(fetch, redmineAuthHeaders(env.redmine.apiKey) ?? {}, diagnostics),
        adapter: redmineAdapter,
        baseUrl: env.redmine.baseUrl,
        fixture: NORDWIND,
      }),
      openproject: createOpenProjectSeeder({
        http: createJsonHttp(fetch, openProjectAuth, diagnostics),
        adapter: openProjectAdapter,
        baseUrl: env.openProject.baseUrl,
        fixture: HELIOS,
        sleep,
      }),
    },
  });

  if (outcome.exitCode !== 0 && diagnostics.lastErrorBody) {
    report(`last tracker error body: ${diagnostics.lastErrorBody.slice(0, 800)}`);
  }
  return outcome.exitCode;
}

process.exitCode = await main(process.argv.slice(2));

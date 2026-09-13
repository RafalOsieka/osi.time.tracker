import { z } from 'zod';

/** Runs `docker compose --profile trackers ps --format json` and returns its stdout. */
export type ComposePsRunner = () => Promise<string>;

const psLineSchema = z.object({
  Service: z.string(),
  State: z.string(),
  Health: z.string().optional(),
});

export type TrackerService = 'openproject' | 'redmine';

export const TRACKER_SERVICES: readonly TrackerService[] = ['openproject', 'redmine'];

export interface ServiceStatus {
  service: TrackerService;
  state: 'absent' | 'starting' | 'healthy' | 'unhealthy';
}

/** Parses one status per tracker service out of the newline-delimited `ps` JSON. */
export function parseComposePs(stdout: string): ServiceStatus[] {
  const rows = stdout
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      const parsed = psLineSchema.safeParse(JSON.parse(line));
      return parsed.success ? [parsed.data] : [];
    });
  return TRACKER_SERVICES.map((service) => {
    const row = rows.find((candidate) => candidate.Service === service);
    if (!row || row.State !== 'running') return { service, state: 'absent' };
    if (row.Health === 'healthy') return { service, state: 'healthy' };
    if (row.Health === 'unhealthy') return { service, state: 'unhealthy' };
    return { service, state: 'starting' };
  });
}

export class TrackersNotHealthyError extends Error {
  constructor(readonly statuses: ServiceStatus[]) {
    const detail = statuses
      .filter((status) => status.state !== 'healthy')
      .map((status) => `${status.service} is ${status.state}`)
      .join(', ');
    super(
      `Local trackers are not ready (${detail}). Start them with ` +
        '`docker compose --profile trackers up -d` and wait for the healthchecks.',
    );
    this.name = 'TrackersNotHealthyError';
  }
}

export interface WaitOptions {
  /** Upper bound on the whole wait; first boot of OpenProject takes ~2 minutes. */
  timeoutMs: number;
  pollMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

/**
 * Polls compose until both trackers are healthy. Gives up immediately when a
 * service is absent (nothing to wait for) and after `timeoutMs` otherwise.
 */
export async function waitForTrackers(
  runPs: ComposePsRunner,
  options: WaitOptions,
): Promise<ServiceStatus[]> {
  const deadline = options.now() + options.timeoutMs;
  for (;;) {
    const statuses = parseComposePs(await runPs());
    if (statuses.every((status) => status.state === 'healthy')) return statuses;
    if (statuses.some((status) => status.state === 'absent' || status.state === 'unhealthy')) {
      throw new TrackersNotHealthyError(statuses);
    }
    if (options.now() >= deadline) throw new TrackersNotHealthyError(statuses);
    await options.sleep(options.pollMs);
  }
}

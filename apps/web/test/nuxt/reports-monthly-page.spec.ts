import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Router } from 'vue-router';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import MonthlyReportPage from '../../app/pages/reports/monthly.vue';
import type { MonthlyReportDto } from '../../shared/types/report';
import type { TrackerDto } from '../../shared/types/tracker';

/**
 * Wiring of the monthly report page: loading/empty/error states (REQ-391),
 * per-tracker remote fetches and month navigation. Timesheet math is covered
 * by `test/unit/monthly-timesheet.spec.ts`.
 */
/** State the page's mocks read; tests replace it before mounting. */
interface ReportHarness {
  query: Record<string, string>;
  report: { data: MonthlyReportDto | null; pending: boolean; error: Error | null };
  trackers: TrackerDto[];
  secrets: Record<string, string>;
}
const harness = vi.hoisted(() => ({
  ...((): ReportHarness => ({
    query: { month: '2026-09' },
    report: { data: null, pending: true, error: null },
    trackers: [],
    secrets: {},
  }))(),
  createAdapter: vi.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- the adapter factory reaches real trackers and has no injection seam
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: harness.createAdapter,
}));
// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  const { ref } = await import('vue');
  return { ...actual, useI18n: () => ({ t: (key: string) => key, locale: ref('en') }) };
});

mockNuxtImport('useRoute', () => () => ({
  path: '/reports/monthly',
  query: harness.query,
}));
mockNuxtImport('useTrackerSecret', () => () => ({
  get: (id: string) => harness.secrets[id] ?? null,
}));
mockNuxtImport('useAsyncData', () => {
  return (key: string | (() => string)) => {
    if (key === 'trackers') {
      return {
        data: ref(harness.trackers),
        pending: ref(false),
        status: ref('success'),
        error: ref(null),
      };
    }
    return {
      data: ref(harness.report.data),
      pending: ref(harness.report.pending),
      error: ref(harness.report.error),
    };
  };
});

const emptyMonth: MonthlyReportDto = {
  month: '2026-09',
  timezone: 'UTC',
  trackers: [],
  days: [],
  exports: [],
};

// The page sets the table test id; the stub only exposes the loading prop.
const stubs = {
  UTable: {
    props: ['loading'],
    template: '<div :data-loading="loading" />',
  },
};

let replace: MockInstance<Router['replace']>;
let push: MockInstance<Router['push']>;

beforeEach(() => {
  vi.restoreAllMocks();
  harness.createAdapter.mockReset();
  const router = useRouter();
  replace = vi.spyOn(router, 'replace').mockResolvedValue(undefined);
  push = vi.spyOn(router, 'push').mockResolvedValue(undefined);
  harness.query = { month: '2026-09' };
  harness.report = { data: null, pending: true, error: null };
  harness.trackers = [];
  harness.secrets = {};
});

describe('monthly report page loading state', () => {
  it('renders without the report and shows the loading table, not the empty state', async () => {
    const wrapper = await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="reports-month-next"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid^="reports-monthly-table"]').attributes('data-loading')).toBe(
      'true',
    );
    expect(wrapper.find('[data-testid="reports-monthly-empty"]').exists()).toBe(false);
  });

  it('shows the empty state only once an empty month has arrived', async () => {
    harness.report = { data: emptyMonth, pending: false, error: null };
    const wrapper = await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="reports-monthly-empty"]').exists()).toBe(true);
  });

  it('shows the error state instead of a loading state when the report fails', async () => {
    harness.report = { data: null, pending: false, error: new Error('boom') };
    const wrapper = await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="reports-monthly-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid^="reports-monthly-table"]').exists()).toBe(false);
  });
});

const openProject: TrackerDto = {
  id: 'op',
  name: 'OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const redmine: TrackerDto = {
  ...openProject,
  id: 'rm',
  name: 'Redmine',
  systemType: 'redmine',
  baseUrl: 'https://rm.example',
};

const monthWithTrackers: MonthlyReportDto = {
  ...emptyMonth,
  trackers: [
    { id: openProject.id, name: openProject.name },
    { id: redmine.id, name: redmine.name },
  ],
  days: [{ date: '2026-09-01', localSeconds: 3600 }],
};

function remoteLog(spentOn: string, durationSeconds: number): RemoteTimeLogDto {
  return {
    remoteLogId: `log-${spentOn}`,
    remoteIssueId: '1',
    spentOn,
    durationSeconds,
    activityId: null,
    activityName: null,
    comment: null,
    remoteUserId: null,
    remoteIssueTitle: null,
  };
}

/** Adapter double: logs per tracker id, or an Error to reject with. */
function adapterReturning(byTracker: Record<string, RemoteTimeLogDto[] | Error>) {
  harness.createAdapter.mockImplementation((tracker: TrackerDto) => ({
    fetchTimeLogsInRange: vi.fn(async () => {
      const result = byTracker[tracker.id] ?? [];
      if (result instanceof Error) throw result;
      return result;
    }),
  }));
}

async function mountLoadedMonth() {
  harness.report = { data: monthWithTrackers, pending: false, error: null };
  harness.trackers = [openProject, redmine];
  // The real table renders the cells; the tooltip only needs to pass its trigger through.
  const wrapper = await mountSuspended(MonthlyReportPage, {
    global: { stubs: { UTooltip: { template: '<span><slot /></span>' } } },
  });
  await flushPromises();
  return wrapper;
}

describe('monthly report page remote hours', () => {
  it('fails a tracker without a stored secret and never builds its adapter', async () => {
    harness.secrets = { [redmine.id]: 'rm-key' };
    adapterReturning({ [redmine.id]: [remoteLog('2026-09-01', 1800)] });
    const wrapper = await mountLoadedMonth();

    expect(harness.createAdapter).toHaveBeenCalledTimes(1);
    expect(harness.createAdapter).toHaveBeenCalledWith(redmine, 'rm-key');
    expect(wrapper.get('[data-testid="reports-tracker-op-2026-09-01-app"]').text()).toBe(
      'reports.monthly.trackerError',
    );
    expect(wrapper.find('[data-testid="reports-warning-2026-09-01-fetch-op"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="reports-tracker-rm-2026-09-01-direct"]').text()).not.toBe(
      'reports.monthly.trackerError',
    );
  });

  it('reports the remote summary as failed when no tracker could be fetched', async () => {
    const wrapper = await mountLoadedMonth();

    const summary = wrapper.get('[data-testid="reports-summary-remote"]');
    expect(summary.attributes('aria-label')).toBe('reports.monthly.summaryRemoteFailed');
    expect(summary.text()).toContain('reports.monthly.trackerError');
  });

  it('fails only the tracker whose fetch rejects and keeps the others loaded', async () => {
    harness.secrets = { [openProject.id]: 'op-key', [redmine.id]: 'rm-key' };
    adapterReturning({
      [openProject.id]: new Error('network down'),
      [redmine.id]: [remoteLog('2026-09-01', 1800)],
    });
    const wrapper = await mountLoadedMonth();

    expect(wrapper.get('[data-testid="reports-tracker-op-total-total"]').text()).toBe(
      'reports.monthly.trackerError',
    );
    expect(wrapper.get('[data-testid="reports-tracker-rm-2026-09-01-direct"]').text()).not.toBe(
      'reports.monthly.trackerError',
    );
    expect(
      wrapper.get('[data-testid="reports-summary-remote"]').attributes('aria-label'),
    ).toBeUndefined();
  });
});

describe('monthly report page month navigation', () => {
  it('moves to the previous and next month', async () => {
    harness.report = { data: emptyMonth, pending: false, error: null };
    const wrapper = await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();

    await wrapper.get('[data-testid="reports-month-next"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/reports/monthly',
      query: { month: '2026-10' },
    });
    await wrapper.get('[data-testid="reports-month-prev"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/reports/monthly',
      query: { month: '2026-08' },
    });
  });

  it('writes the month the server defaulted to into the URL', async () => {
    harness.query = {};
    harness.report = { data: emptyMonth, pending: false, error: null };
    await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();

    expect(replace).toHaveBeenCalledWith({ path: '/reports/monthly', query: { month: '2026-09' } });
  });

  it('leaves the URL alone when it already names the reported month', async () => {
    harness.report = { data: emptyMonth, pending: false, error: null };
    await mountSuspended(MonthlyReportPage, { global: { stubs } });
    await flushPromises();

    expect(replace).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/reports/monthly' }));
  });
});

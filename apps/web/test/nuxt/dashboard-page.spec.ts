import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Router } from 'vue-router';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import DashboardPage from '../../app/pages/index.vue';
import type { DashboardDto } from '../../shared/types/dashboard';

/** The Dashboard page for given API answers; the numbers are the API suite's. */
interface DashboardHarness {
  query: Record<string, string | null | string[]>;
}
const harness = vi.hoisted(() => ({ fetch: vi.fn() }));
const route = reactive<DashboardHarness>({ query: {} });

mockNuxtImport('useRoute', () => () => route);
mockNuxtImport('useRequestFetch', () => () => harness.fetch);

const november: DashboardDto = {
  period: { kind: 'month', firstDay: '2026-11-01', lastDay: '2026-11-30' },
  today: '2026-11-24',
  timezone: 'UTC',
  firstDayOfWeek: 1,
  hasEntries: true,
  summary: { totalSeconds: 27_000, daysWithEntries: 4, averageSeconds: 6750 },
  buckets: [],
  groups: {
    project: [
      {
        kind: 'project',
        id: 'p1',
        name: 'Site',
        deleted: true,
        totalSeconds: 13_500,
        bucketSeconds: [],
      },
      { kind: 'noProject', totalSeconds: 9000, bucketSeconds: [] },
      {
        kind: 'project',
        id: 'p2',
        name: 'Site',
        deleted: false,
        totalSeconds: 4500,
        bucketSeconds: [],
      },
    ],
    tracker: [
      {
        kind: 'tracker',
        id: 't1',
        name: 'Redmine',
        deleted: false,
        totalSeconds: 13_500,
        bucketSeconds: [],
      },
      { kind: 'noProject', totalSeconds: 9000, bucketSeconds: [] },
      { kind: 'local', totalSeconds: 4500, bucketSeconds: [] },
    ],
  },
};
const march: DashboardDto = {
  ...november,
  period: { kind: 'month', firstDay: '2026-03-01', lastDay: '2026-03-31' },
};
const emptyNovember: DashboardDto = {
  ...november,
  summary: { totalSeconds: 0, daysWithEntries: 0, averageSeconds: 0 },
  groups: { project: [], tracker: [] },
};

// The stepper's tooltips need the `UApp` provider, so they only pass their trigger through.
const stubs = { UTooltip: { template: '<span><slot /></span>' } };

let push: MockInstance<Router['push']>;
let wrapper: VueWrapper;

async function mountPage(): Promise<VueWrapper> {
  wrapper = await mountSuspended(DashboardPage, { global: { stubs } });
  await flushPromises();
  return wrapper;
}

function byTestId(id: string) {
  return wrapper.find(`[data-testid="${id}"]`);
}

/** Leaves the next request pending until the returned function answers it. */
function holdAnswer() {
  let answer = (_dashboard: DashboardDto) => {};
  harness.fetch.mockReturnValue(
    new Promise<DashboardDto>((resolve) => {
      answer = resolve;
    }),
  );
  return answer;
}

/** The table's text, one list of cells per row, the headings first. */
function tableText() {
  return byTestId('dashboard-groups-table')
    .findAll('tr')
    .filter((row) => row.find('th, td').exists())
    .map((row) => row.findAll('th, td').map((cell) => cell.text()));
}

const STATES = ['loading', 'error', 'summary', 'empty-period', 'empty-account'] as const;

function visibleStates() {
  return STATES.filter((state) => byTestId(`dashboard-${state}`).exists());
}

beforeEach(() => {
  vi.restoreAllMocks();
  push = vi.spyOn(useRouter(), 'push').mockResolvedValue(undefined);
  route.query = {};
  harness.fetch.mockReset().mockResolvedValue(november);
});

afterEach(() => {
  wrapper.unmount();
  clearNuxtData();
});

describe('Dashboard states', () => {
  it('shows the loading state until the answer arrives', async () => {
    const answer = holdAnswer();
    await mountPage();
    expect(visibleStates()).toEqual(['loading']);
    expect(byTestId('dashboard-loading').attributes('aria-busy')).toBe('true');

    answer(november);
    await flushPromises();
    expect(visibleStates()).toEqual(['summary']);
  });

  it('shows the total, the days with entries and the average of the period', async () => {
    await mountPage();
    expect(byTestId('dashboard-total').text()).toBe('7:30');
    expect(byTestId('dashboard-days').text()).toBe('4');
    expect(byTestId('dashboard-average').text()).toBe('1:52');
  });

  it('shows zeros and a message for a period without entries', async () => {
    harness.fetch.mockResolvedValue(emptyNovember);
    await mountPage();
    expect(visibleStates()).toEqual(['summary', 'empty-period']);
    expect(byTestId('dashboard-total').text()).toBe('0:00');
    expect(byTestId('dashboard-days').text()).toBe('0');
    expect(byTestId('dashboard-average').text()).toBe('0:00');
  });

  it('points an account without entries to the Timer', async () => {
    harness.fetch.mockResolvedValue({ ...emptyNovember, hasEntries: false });
    await mountPage();
    expect(visibleStates()).toEqual(['empty-account']);

    await byTestId('empty-state-cta').trigger('click');
    expect(push).toHaveBeenLastCalledWith('/timer');
  });

  it('shows the translated reason when the period in the URL is invalid', async () => {
    route.query = { period: 'decade' };
    const invalid = Object.assign(new Error('422'), {
      data: { data: { messageKey: 'error.dashboardPeriodInvalid' } },
    });
    harness.fetch.mockRejectedValue(invalid);
    await mountPage();
    expect(visibleStates()).toEqual(['error']);
    expect(byTestId('dashboard-error').text()).toBe('Choose a week, a month or a year.');
    expect(byTestId('dashboard-error').attributes('role')).toBe('alert');
  });

  it('shows a general error when the load fails', async () => {
    harness.fetch.mockRejectedValue(new Error('boom'));
    await mountPage();
    expect(visibleStates()).toEqual(['error']);
    expect(byTestId('dashboard-error').text()).toBe('The Dashboard could not be loaded.');
    expect(byTestId('dashboard-groups').exists()).toBe(false);
  });
});

describe('Dashboard while another period loads', () => {
  it('replaces the previous error with the loading state', async () => {
    route.query = { period: 'decade' };
    harness.fetch.mockRejectedValue(new Error('422'));
    await mountPage();
    expect(visibleStates()).toEqual(['error']);

    const answer = holdAnswer();
    route.query = { period: 'month' };
    await flushPromises();
    expect(visibleStates()).toEqual(['loading']);

    answer(november);
    await flushPromises();
    expect(visibleStates()).toEqual(['summary']);
  });

  it('keeps the period label and switches the kind around the asked day', async () => {
    await mountPage();
    holdAnswer();
    route.query = { period: 'month', date: '2026-10-31' };
    await flushPromises();
    expect(byTestId('dashboard-period-label').text()).toBe('November 2026');

    await byTestId('dashboard-kind-week').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/',
      query: { period: 'week', date: '2026-10-31' },
    });
  });

  it('ignores a step until the shown period is the asked one', async () => {
    await mountPage();
    holdAnswer();
    route.query = { period: 'month', date: '2026-10-31' };
    await flushPromises();

    await byTestId('dashboard-prev').trigger('click');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('Dashboard time per group', () => {
  it('lists every Project with its time and share', async () => {
    await mountPage();
    expect(tableText()).toEqual([
      ['Project', 'Time', 'Share'],
      ['Site deleted', '3:45', '50%'],
      ['No project', '2:30', '33%'],
      ['Site', '1:15', '17%'],
    ]);
    const table = byTestId('dashboard-groups-table');
    expect(table.find('caption').text()).toBe('Time by Project');
    expect(table.findAll('[scope="row"]').map((header) => header.text())).toEqual([
      'Site deleted',
      'No project',
      'Site',
    ]);
  });

  it('switches to the Trackers without a request or a new address', async () => {
    await mountPage();
    const project = byTestId('dashboard-grouping-project');
    const tracker = byTestId('dashboard-grouping-tracker');
    expect(project.attributes('aria-pressed')).toBe('true');
    expect(tracker.attributes('aria-pressed')).toBe('false');

    await tracker.trigger('click');
    expect(tableText()).toEqual([
      ['Tracker', 'Time', 'Share'],
      ['Redmine', '3:45', '50%'],
      ['No project', '2:30', '33%'],
      ['Local', '1:15', '17%'],
    ]);
    expect(byTestId('dashboard-groups-table').find('caption').text()).toBe('Time by Tracker');
    expect(byTestId('dashboard-grouping-project').attributes('aria-pressed')).toBe('false');
    expect(byTestId('dashboard-grouping-tracker').attributes('aria-pressed')).toBe('true');
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('lists every group of a long period', async () => {
    const project = Array.from({ length: 12 }, (_, index) => ({
      kind: 'project' as const,
      id: `p${index}`,
      name: `Project ${index}`,
      deleted: false,
      totalSeconds: 2250,
      bucketSeconds: [],
    }));
    harness.fetch.mockResolvedValue({ ...november, groups: { project, tracker: [] } });
    await mountPage();
    expect(tableText()).toHaveLength(13);
  });

  it('reads naturally in Polish', async () => {
    const { $i18n } = useNuxtApp();
    await $i18n.setLocale('pl');
    try {
      await mountPage();
      await byTestId('dashboard-grouping-tracker').trigger('click');
      expect(tableText()).toEqual([
        ['Tracker', 'Czas', 'Udział'],
        ['Redmine', '3:45', '50%'],
        ['Bez projektu', '2:30', '33%'],
        ['Lokalne', '1:15', '17%'],
      ]);
      await byTestId('dashboard-grouping-project').trigger('click');
      expect(tableText()[1]).toEqual(['Site usunięty', '3:45', '50%']);
    } finally {
      await $i18n.setLocale('en');
    }
  });

  it('shows placeholders while another period loads and keeps the grouping', async () => {
    await mountPage();
    await byTestId('dashboard-grouping-tracker').trigger('click');

    const answer = holdAnswer();
    route.query = { period: 'month', date: '2026-03-31' };
    await flushPromises();
    expect(byTestId('dashboard-groups-table').exists()).toBe(false);
    expect(byTestId('dashboard-groups').attributes('aria-busy')).toBe('true');

    answer(march);
    await flushPromises();
    expect(tableText()[0]).toEqual(['Tracker', 'Time', 'Share']);
    expect(byTestId('dashboard-groups').attributes('aria-busy')).toBe('false');
  });

  it('keeps the grouping across an empty period', async () => {
    await mountPage();
    await byTestId('dashboard-grouping-tracker').trigger('click');

    harness.fetch.mockResolvedValue(emptyNovember);
    route.query = { period: 'week' };
    await flushPromises();
    expect(byTestId('dashboard-groups').exists()).toBe(false);

    harness.fetch.mockResolvedValue(november);
    route.query = {};
    await flushPromises();
    expect(tableText()[0]).toEqual(['Tracker', 'Time', 'Share']);
  });
});

describe('Dashboard period', () => {
  it('asks for exactly what the URL says, repeated values included', async () => {
    route.query = { period: ['week', 'month'], date: '2026-08-05', other: 'x' };
    await mountPage();
    expect(harness.fetch).toHaveBeenCalledExactlyOnceWith('/api/dashboard', {
      query: { period: ['week', 'month'], date: '2026-08-05' },
    });
  });

  it.each<[string, DashboardDto['period'], string]>([
    ['month', november.period, 'November 2026'],
    ['year', { kind: 'year', firstDay: '2026-01-01', lastDay: '2026-12-31' }, '2026'],
    [
      'week',
      { kind: 'week', firstDay: '2026-12-28', lastDay: '2027-01-03' },
      'Dec 28, 2026 – Jan 3, 2027',
    ],
  ])('labels a %s', async (kind, period, label) => {
    route.query = { period: kind };
    harness.fetch.mockResolvedValue({ ...november, period });
    await mountPage();
    expect(byTestId('dashboard-period-label').text()).toBe(label);
    const pressed = wrapper.findAll('[data-testid^="dashboard-kind-"][aria-pressed="true"]');
    expect(pressed.map((button) => button.attributes('data-testid'))).toEqual([
      `dashboard-kind-${kind}`,
    ]);
  });

  it('steps to the previous and the next period', async () => {
    route.query = { date: '2026-03-17' };
    harness.fetch.mockResolvedValue(march);
    await mountPage();

    await byTestId('dashboard-next').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/',
      query: { period: 'month', date: '2026-04-01' },
    });
    await byTestId('dashboard-prev').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/',
      query: { period: 'month', date: '2026-02-28' },
    });
  });

  it.each<[string, Partial<DashboardDto>, boolean]>([
    ['the current period', {}, true],
    ['a period ending today', { today: '2026-11-30' }, true],
    ['the period before the current one', { today: '2026-12-01' }, false],
    ['a future period', { today: '2026-05-01' }, true],
  ])('%s has the next step unavailable: %s', async (_label, overrides, unavailable) => {
    harness.fetch.mockResolvedValue({ ...november, ...overrides });
    await mountPage();
    expect(byTestId('dashboard-next').attributes('disabled') !== undefined).toBe(unavailable);
    expect(byTestId('dashboard-prev').attributes('disabled')).toBeUndefined();
  });

  it('switches from the current period to the one containing today', async () => {
    route.query = { date: '2026-11-01' };
    await mountPage();
    await byTestId('dashboard-kind-week').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/',
      query: { period: 'week', date: '2026-11-24' },
    });
  });

  it('keeps the asked day when switching away from a past period', async () => {
    route.query = { date: '2026-03-17' };
    harness.fetch.mockResolvedValue(march);
    await mountPage();
    await byTestId('dashboard-kind-week').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/',
      query: { period: 'week', date: '2026-03-17' },
    });
  });

  it('leads out of an invalid date', async () => {
    route.query = { period: 'month', date: 'yesterday' };
    harness.fetch.mockRejectedValue(new Error('422'));
    await mountPage();
    expect(byTestId('dashboard-prev').attributes('disabled')).toBeDefined();
    expect(byTestId('dashboard-next').attributes('disabled')).toBeDefined();

    await byTestId('dashboard-kind-month').trigger('click');
    expect(push).toHaveBeenLastCalledWith({ path: '/', query: { period: 'month' } });
  });
});

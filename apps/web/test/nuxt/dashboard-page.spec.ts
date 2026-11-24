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
        colorSlot: 0,
      },
      { kind: 'noProject', totalSeconds: 9000, bucketSeconds: [], colorSlot: null },
      {
        kind: 'project',
        id: 'p2',
        name: 'Site',
        deleted: false,
        totalSeconds: 4500,
        bucketSeconds: [],
        colorSlot: 1,
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
        colorSlot: 0,
      },
      { kind: 'noProject', totalSeconds: 9000, bucketSeconds: [], colorSlot: null },
      { kind: 'local', totalSeconds: 4500, bucketSeconds: [], colorSlot: 1 },
    ],
  },
  topTasks: [
    {
      id: 'k1',
      name: 'Checkout',
      project: { id: 'p1', name: 'Site', deleted: true },
      remoteIssue: { id: '42', title: 'Fix the checkout', url: 'https://op.example.com/wp/42' },
      totalSeconds: 9000,
    },
    {
      id: 'k2',
      name: 'Checkout',
      project: { id: 'p2', name: 'Site', deleted: false },
      remoteIssue: null,
      totalSeconds: 5400,
    },
    {
      id: 'k3',
      name: 'Admin',
      project: null,
      remoteIssue: { id: '7', title: 'Bookkeeping', url: null },
      totalSeconds: 1800,
    },
  ],
  exportBacklog: ['2026-10-30', '2026-11-12'],
};
const march: DashboardDto = {
  ...november,
  period: { kind: 'month', firstDay: '2026-03-01', lastDay: '2026-03-31' },
};
const emptyNovember: DashboardDto = {
  ...november,
  summary: { totalSeconds: 0, daysWithEntries: 0, averageSeconds: 0 },
  groups: { project: [], tracker: [] },
  topTasks: [],
};

const WEEK_BUCKETS = [
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
];
/** Seconds on the first days of the week, zero on the rest. */
function weekSeconds(...seconds: number[]): number[] {
  return WEEK_BUCKETS.map((_, index) => seconds[index] ?? 0);
}
const week: DashboardDto = {
  ...november,
  period: { kind: 'week', firstDay: '2026-11-16', lastDay: '2026-11-22' },
  summary: { totalSeconds: 18_000, daysWithEntries: 3, averageSeconds: 6000 },
  buckets: WEEK_BUCKETS,
  groups: {
    project: [
      {
        kind: 'project',
        id: 'p1',
        name: 'Site',
        deleted: false,
        totalSeconds: 12_600,
        bucketSeconds: weekSeconds(7200, 5400),
        colorSlot: 3,
      },
      {
        kind: 'noProject',
        totalSeconds: 3600,
        bucketSeconds: weekSeconds(1800, 0, 1800),
        colorSlot: null,
      },
      {
        kind: 'project',
        id: 'p2',
        name: 'Shop',
        deleted: false,
        totalSeconds: 1800,
        bucketSeconds: weekSeconds(1800),
        colorSlot: 0,
      },
    ],
    tracker: [],
  },
};

// Tooltips need the `UApp` provider, so they pass their trigger through and show their content
// only while open.
const stubs = {
  UTooltip: {
    props: ['open'],
    template: '<span><slot /><span v-if="open"><slot name="content" /></span></span>',
  },
};

let push: MockInstance<Router['push']>;
let wrapper: VueWrapper;

async function mountPage(): Promise<VueWrapper> {
  // Attached, so that focus moves between the chart's columns.
  wrapper = await mountSuspended(DashboardPage, { global: { stubs }, attachTo: document.body });
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
    expect(byTestId('dashboard-tasks').exists()).toBe(false);
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
    expect(byTestId('dashboard-tasks').exists()).toBe(false);
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
      colorSlot: index < 6 ? index : null,
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

describe('Dashboard top Tasks', () => {
  /** The text a screen reader gets, its blocks apart, without what is hidden from it. */
  function spokenText(element: Element): string {
    const texts: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('[aria-hidden="true"]')) texts.push(node.textContent ?? '');
    }
    return texts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /** Each Task row as its cells' spoken text, the headings first. */
  function tasksText() {
    return byTestId('dashboard-tasks-table')
      .findAll('tr')
      .map((row) => row.findAll('th, td').map((cell) => spokenText(cell.element)));
  }

  it('lists each Task with its Project, Remote issue and time', async () => {
    await mountPage();
    expect(tasksText()).toEqual([
      ['Task', 'Remote issue', 'Time'],
      ['Checkout Site deleted', '#42: Fix the checkout', '2:30'],
      ['Checkout Site', '', '1:30'],
      ['Admin No project', '#7: Bookkeeping', '0:30'],
    ]);
    const table = byTestId('dashboard-tasks-table');
    expect(table.find('caption').text()).toBe(
      'Tasks with the most time in the period, with their project, remote issue and time',
    );
    expect(table.findAll('[scope="row"]').map((header) => spokenText(header.element))).toEqual([
      'Checkout Site deleted',
      'Checkout Site',
      'Admin No project',
    ]);
  });

  it('links a Task to its Remote issue only when the issue has an address', async () => {
    await mountPage();
    const issues = wrapper.findAll('[data-testid="dashboard-task-issue"]');
    expect(issues.map((issue) => issue.find('[aria-hidden="true"]').text())).toEqual(['#42', '#7']);
    const links = byTestId('dashboard-tasks-table').findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes('href')).toBe('https://op.example.com/wp/42');
    expect(links[0]?.attributes('target')).toBe('_blank');
    expect(issues[1]?.attributes('tabindex')).toBe('0');
  });

  it('says so instead of an empty list when the period has no Task', async () => {
    harness.fetch.mockResolvedValue({ ...november, topTasks: [] });
    await mountPage();
    expect(byTestId('dashboard-tasks-table').exists()).toBe(false);
    expect(byTestId('dashboard-tasks-empty').text()).toBe('No tasks in this period.');
  });

  it('shows placeholders while another period loads', async () => {
    await mountPage();
    const answer = holdAnswer();
    route.query = { period: 'month', date: '2026-03-31' };
    await flushPromises();
    expect(byTestId('dashboard-tasks-table').exists()).toBe(false);
    expect(byTestId('dashboard-tasks-empty').exists()).toBe(false);
    expect(byTestId('dashboard-tasks').attributes('aria-busy')).toBe('true');

    answer(march);
    await flushPromises();
    expect(tasksText()).toHaveLength(4);
    expect(byTestId('dashboard-tasks').attributes('aria-busy')).toBe('false');
  });

  it('reads naturally in Polish', async () => {
    const { $i18n } = useNuxtApp();
    await $i18n.setLocale('pl');
    try {
      await mountPage();
      expect(byTestId('dashboard-tasks').find('h2').text()).toBe('Zadania z największym czasem');
      expect(tasksText()).toEqual([
        ['Zadanie', 'Zgłoszenie', 'Czas'],
        ['Checkout Site usunięty', '#42: Fix the checkout', '2:30'],
        ['Checkout Site', '', '1:30'],
        ['Admin Bez projektu', '#7: Bookkeeping', '0:30'],
      ]);
    } finally {
      await $i18n.setLocale('en');
    }
  });
});

describe('Dashboard Export backlog', () => {
  function backlogLinks() {
    return byTestId('dashboard-export-backlog')
      .findAll('a')
      .map((link) => [link.text(), link.attributes('href')]);
  }

  /** The list's accessible name, from the visible label. */
  function backlogLabel() {
    const id = byTestId('dashboard-export-backlog').find('ul').attributes('aria-labelledby');
    return document.getElementById(id ?? '')?.textContent?.trim();
  }

  it('lists each day of the Export backlog with a link to its Remote Sync page', async () => {
    await mountPage();
    expect(backlogLabel()).toBe('Export backlog:');
    expect(backlogLinks()).toEqual([
      ['Oct 30', '/sync/2026-10-30'],
      ['Nov 12', '/sync/2026-11-12'],
    ]);
  });

  it('is absent when no day is waiting', async () => {
    harness.fetch.mockResolvedValue({ ...november, exportBacklog: [] });
    await mountPage();
    expect(visibleStates()).toEqual(['summary']);
    expect(byTestId('dashboard-export-backlog').exists()).toBe(false);
  });

  it('stays in a period without entries, since it does not depend on the period', async () => {
    harness.fetch.mockResolvedValue(emptyNovember);
    await mountPage();
    expect(backlogLinks()).toHaveLength(2);
  });

  it('is absent when the load fails', async () => {
    harness.fetch.mockRejectedValue(new Error('boom'));
    await mountPage();
    expect(byTestId('dashboard-export-backlog').exists()).toBe(false);
  });

  it('reads naturally in Polish', async () => {
    const { $i18n } = useNuxtApp();
    await $i18n.setLocale('pl');
    try {
      await mountPage();
      expect(backlogLabel()).toBe('Zaległy eksport:');
      expect(backlogLinks().map(([text]) => text)).toEqual(['30 paź', '12 lis']);
    } finally {
      await $i18n.setLocale('en');
    }
  });
});

describe('Dashboard chart', () => {
  function columns() {
    return wrapper.findAll('[data-testid="dashboard-chart-column"]');
  }

  function segmentColors(column: number) {
    return columns()
      [column]!.findAll('[data-testid="dashboard-chart-segment"]')
      .map((segment) => segment.classes().find((name) => name.startsWith('bg-chart-')));
  }

  function tooltip() {
    return byTestId('dashboard-chart-tooltip');
  }

  /** The tooltip's lines, the heading first, its parts split by a space. */
  function tooltipLines() {
    return tooltip()
      .findAll('p, li')
      .map((line) =>
        line
          .findAll('span')
          .map((part) => part.text())
          .filter(Boolean)
          .join(' '),
      );
  }

  it('stacks each day by group and names its breakdown', async () => {
    harness.fetch.mockResolvedValue(week);
    await mountPage();
    expect(columns().map((column) => column.text())).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(columns()[0]!.attributes('aria-label')).toBe(
      'Mon, Nov 16: 3:00, of which Site 2:00, Shop 0:30, No project 0:30',
    );
    expect(columns()[3]!.attributes('aria-label')).toBe('Thu, Nov 19: 0:00');
    expect(segmentColors(0)).toEqual(['bg-chart-4', 'bg-chart-1', 'bg-chart-no-project']);
    expect(segmentColors(3)).toEqual([]);
    expect(
      wrapper.findAll('[data-testid="dashboard-chart-tick"]').map((tick) => tick.text()),
    ).toEqual(['0 h', '1 h', '2 h', '3 h']);
    expect(byTestId('dashboard-chart').find('[role="grid"]').attributes('aria-label')).toBe(
      'Time by Project per day',
    );
  });

  it('colors the six largest groups and folds the rest into Other, before No project', async () => {
    const project = Array.from({ length: 8 }, (_, index) => ({
      kind: 'project' as const,
      id: `p${index}`,
      name: `Project ${index}`,
      deleted: false,
      totalSeconds: (8 - index) * 600,
      bucketSeconds: weekSeconds((8 - index) * 600),
      colorSlot: index < 6 ? (index + 2) % 6 : null,
    }));
    const noProject = {
      kind: 'noProject' as const,
      totalSeconds: 60,
      bucketSeconds: weekSeconds(60),
      colorSlot: null,
    };
    harness.fetch.mockResolvedValue({
      ...week,
      groups: { project: [...project, noProject], tracker: [] },
    });
    await mountPage();

    const colored = ['bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6', 'bg-chart-1'];
    expect(segmentColors(0)).toEqual([
      ...colored,
      'bg-chart-2',
      'bg-chart-other',
      'bg-chart-no-project',
    ]);
    const swatches = wrapper.findAll('[data-testid="dashboard-group-swatch"]');
    expect(
      swatches.map((swatch) => swatch.classes().find((name) => name.startsWith('bg-'))),
    ).toEqual([
      ...colored,
      'bg-chart-2',
      'bg-chart-other',
      'bg-chart-other',
      'bg-chart-no-project',
    ]);

    await columns()[0]!.trigger('mouseover');
    expect(tooltipLines().slice(1, 4)).toEqual(['No project 0:01', 'Other 0:30', 'Project 5 0:30']);
  });

  it('labels the months of a year and the chart by month', async () => {
    const buckets = Array.from({ length: 12 }, (_, index) => {
      return `2026-${String(index + 1).padStart(2, '0')}-01`;
    });
    harness.fetch.mockResolvedValue({
      ...week,
      period: { kind: 'year', firstDay: '2026-01-01', lastDay: '2026-12-31' },
      buckets,
      groups: {
        project: [
          {
            kind: 'project',
            id: 'p1',
            name: 'Site',
            deleted: false,
            totalSeconds: 540_000,
            bucketSeconds: buckets.map((_, index) => (index === 7 ? 540_000 : 0)),
            colorSlot: 0,
          },
        ],
        tracker: [],
      },
    });
    await mountPage();
    expect(columns().map((column) => column.text())).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
    expect(columns()[7]!.attributes('aria-label')).toBe(
      'August 2026: 150:00, of which Site 150:00',
    );
    expect(
      wrapper.findAll('[data-testid="dashboard-chart-tick"]').map((tick) => tick.text()),
    ).toEqual(['0 h', '50 h', '100 h', '150 h']);
    expect(byTestId('dashboard-chart').find('[role="grid"]').attributes('aria-label')).toBe(
      'Time by Project per month',
    );
  });

  it('is one tab stop that arrow keys, Home and End move through', async () => {
    harness.fetch.mockResolvedValue(week);
    await mountPage();
    const tabStops = () => columns().map((column) => column.attributes('tabindex'));
    expect(tabStops()).toEqual(['0', '-1', '-1', '-1', '-1', '-1', '-1']);

    const first = columns()[0]!.element;
    if (!(first instanceof HTMLElement)) throw new Error('A column is an element');
    first.focus();
    await columns()[0]!.trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(columns()[1]!.element);
    expect(tabStops()).toEqual(['-1', '0', '-1', '-1', '-1', '-1', '-1']);

    await columns()[1]!.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(columns()[6]!.element);
    await columns()[6]!.trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(columns()[6]!.element);
    await columns()[6]!.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(columns()[0]!.element);
    await columns()[0]!.trigger('keydown', { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(columns()[0]!.element);
  });

  it('shows the breakdown of a column on hover and on focus', async () => {
    harness.fetch.mockResolvedValue(week);
    await mountPage();
    expect(tooltip().exists()).toBe(false);

    await columns()[1]!.trigger('mouseover');
    expect(tooltipLines()).toEqual(['Tue, Nov 17 1:30', 'Site 1:30']);
    await tooltip().trigger('pointerover');
    expect(tooltip().exists()).toBe(true);
    await byTestId('dashboard-total').trigger('pointerover');
    expect(tooltip().exists()).toBe(false);

    await columns()[0]!.trigger('focusin');
    expect(tooltipLines()).toEqual([
      'Mon, Nov 16 3:00',
      'No project 0:30',
      'Shop 0:30',
      'Site 2:00',
    ]);
    await columns()[0]!.trigger('keydown', { key: 'Escape' });
    expect(tooltip().exists()).toBe(false);
    await columns()[2]!.trigger('mouseover');
    await byTestId('dashboard-grouping-tracker').trigger('keydown', { key: 'Escape' });
    expect(tooltip().exists()).toBe(false);
    await byTestId('dashboard-total').trigger('pointerover');
    await columns()[0]!.trigger('focusout');
    await columns()[0]!.trigger('focusin');
    expect(tooltip().exists()).toBe(true);
    await columns()[0]!.trigger('focusout');
    expect(tooltip().exists()).toBe(false);
  });

  it('reads naturally in Polish', async () => {
    const { $i18n } = useNuxtApp();
    await $i18n.setLocale('pl');
    try {
      harness.fetch.mockResolvedValue(week);
      await mountPage();
      expect(columns()[0]!.attributes('aria-label')).toBe(
        'pon., 16 lis: 3:00, w tym Site 2:00, Shop 0:30 i Bez projektu 0:30',
      );
      expect(byTestId('dashboard-chart').find('[role="grid"]').attributes('aria-label')).toBe(
        'Czas według projektów w podziale na dni',
      );
    } finally {
      await $i18n.setLocale('en');
    }
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

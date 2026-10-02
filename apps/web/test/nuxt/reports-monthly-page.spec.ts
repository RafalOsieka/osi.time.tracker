import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import MonthlyReportPage from '../../app/pages/reports/monthly.vue';
import type { MonthlyReportDto } from '../../shared/types/report';

/**
 * Loading-state wiring of the monthly report (REQ-391): the page renders while
 * its report request is still pending and never mistakes that for an empty month.
 */
/** State of the report request the page sees; tests replace it before mounting. */
interface ReportHarness {
  report: { data: MonthlyReportDto | null; pending: boolean; error: Error | null };
}
const harness = vi.hoisted((): ReportHarness => ({
  report: { data: null, pending: true, error: null },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  const { ref } = await import('vue');
  return { ...actual, useI18n: () => ({ t: (key: string) => key, locale: ref('en') }) };
});

mockNuxtImport('useRoute', () => () => ({
  path: '/reports/monthly',
  query: { month: '2026-09' },
}));
mockNuxtImport('useTrackerSecret', () => () => ({ get: () => null }));
mockNuxtImport('useAsyncData', () => {
  return (key: string | (() => string)) => {
    if (key === 'trackers') {
      return { data: ref([]), pending: ref(false), status: ref('success'), error: ref(null) };
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

describe('monthly report page loading state', () => {
  beforeEach(() => {
    harness.report = { data: null, pending: true, error: null };
  });

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

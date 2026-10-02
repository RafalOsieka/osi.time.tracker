import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { nextTick } from 'vue';
import type { Router } from 'vue-router';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import ClientReportPage from '../../app/pages/reports/client.vue';
import type { ReportPresetDto } from '../../shared/types/report-preset';
import type { TrackerDto } from '../../shared/types/tracker';
import { currentCalendarMonth } from '../../shared/utils/report-month';

/** Mutable fixtures read by the mocks below; reset in `beforeEach`. */
interface PageFixtures {
  query: Record<string, string>;
  presets: ReportPresetDto[];
  trackers: TrackerDto[];
  secrets: Record<string, string>;
  /** The presets request waits for this before answering. */
  presetsGate: Promise<void>;
  presetsFail: boolean;
}

const harness = vi.hoisted(() => ({
  ...((): PageFixtures => ({
    query: {},
    presets: [],
    trackers: [],
    secrets: {},
    presetsGate: Promise.resolve(),
    presetsFail: false,
  }))(),
  csrfFetch: vi.fn(),
  confirm: vi.fn(async () => true),
  toastError: vi.fn(),
  createAdapter: vi.fn(),
  download: vi.fn(async () => undefined),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$csrfFetch` wraps the Nuxt `$fetch` global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(harness.csrfFetch, { create: () => harness.csrfFetch }),
  };
});
// oxlint-disable-next-line anti-slop/no-module-mocking -- the adapter factory reaches real trackers and has no injection seam
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: harness.createAdapter,
}));
// oxlint-disable-next-line anti-slop/no-module-mocking -- pdfmake renders and downloads a real file in the browser
vi.mock('../../app/utils/client-report/load-pdf-make', () => ({
  loadPdfMake: async () => ({
    createPdf: () => ({ download: harness.download }),
    setFonts: vi.fn(),
  }),
}));
// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  const { ref } = await import('vue');
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        params && Object.keys(params).length > 0 ? `${key} ${JSON.stringify(params)}` : key,
      locale: ref('en'),
    }),
  };
});

mockNuxtImport('useRoute', () => () => ({ path: '/reports/client', query: harness.query }));
mockNuxtImport('useRequestFetch', () => () => async (url: string) => {
  if (url !== '/api/report-presets') return harness.trackers;
  await harness.presetsGate;
  if (harness.presetsFail) throw new Error('presets unavailable');
  return harness.presets;
});
// Lazy like the page: returns at once and settles `status` when the fetcher answers.
mockNuxtImport('useAsyncData', () => {
  return (_key: string, fetcher: () => Promise<ReportPresetDto[] | TrackerDto[]>) => {
    const data = ref<ReportPresetDto[] | TrackerDto[] | null>(null);
    const status = ref<'pending' | 'success' | 'error'>('pending');
    const refresh = vi.fn(async () => {
      status.value = 'pending';
      try {
        data.value = await fetcher();
        status.value = 'success';
      } catch {
        status.value = 'error';
      }
    });
    void refresh();
    return { data, status, refresh };
  };
});
mockNuxtImport('useProfile', () => () => ({ effective: ref({ timeZone: 'UTC' }) }));
mockNuxtImport('useUserSession', () => () => ({
  user: ref({ id: 'user-1', email: 'john.doe@example.com', displayName: 'John Doe' }),
}));
mockNuxtImport('useTrackerSecret', () => () => ({
  get: (id: string) => harness.secrets[id] ?? null,
}));
mockNuxtImport('useAppConfirm', () => () => harness.confirm);
mockNuxtImport('useAppToast', () => () => ({ success: vi.fn(), error: harness.toastError }));

const openProject: TrackerDto = {
  id: '01900000-0000-7000-8000-0000000000a1',
  name: 'Helios OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const redmine: TrackerDto = {
  ...openProject,
  id: '01900000-0000-7000-8000-0000000000a2',
  name: 'Helios Redmine',
  systemType: 'redmine',
  baseUrl: 'https://rm.example',
};

function preset(overrides: Partial<ReportPresetDto> = {}): ReportPresetDto {
  return {
    id: '01900000-0000-7000-8000-0000000000b1',
    clientName: 'Helios Energy',
    trackers: [
      { id: openProject.id, name: openProject.name },
      { id: redmine.id, name: redmine.name },
    ],
    inactiveTrackerCount: 0,
    hoursFormat: 'decimal',
    locale: 'pl',
    lastUsedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function remoteLog(overrides: Partial<RemoteTimeLogDto> = {}): RemoteTimeLogDto {
  return {
    remoteLogId: '1',
    remoteIssueId: '4821',
    spentOn: '2026-09-01',
    durationSeconds: 3600,
    activityId: '1',
    activityName: 'Development',
    comment: 'Work',
    remoteUserId: null,
    remoteIssueTitle: 'Issue',
    ...overrides,
  };
}

/** Adapter double: `logs` per tracker id, or an Error to reject with. */
function adapterReturning(byTracker: Record<string, RemoteTimeLogDto[] | Error>) {
  harness.createAdapter.mockImplementation((tracker: TrackerDto) => ({
    fetchTimeLogsInRange: vi.fn(async () => {
      const result = byTracker[tracker.id] ?? [];
      if (result instanceof Error) throw result;
      return result;
    }),
  }));
}

async function mountPage() {
  const wrapper = await mountSuspended(ClientReportPage);
  await flushPromises();
  return wrapper;
}

async function submitExport(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  await wrapper.get('[data-testid="client-report-form"]').trigger('submit');
  await flushPromises();
}

function exportLabel(wrapper: Awaited<ReturnType<typeof mountPage>>): string {
  return wrapper.get('[data-testid="client-report-export"]').text();
}

function exportMessage(wrapper: Awaited<ReturnType<typeof mountPage>>): string {
  return wrapper.get('[data-testid="client-report-export-message"]').text();
}

let replace: MockInstance<Router['replace']>;
let push: MockInstance<Router['push']>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  const router = useRouter();
  replace = vi.spyOn(router, 'replace').mockResolvedValue(undefined);
  push = vi.spyOn(router, 'push').mockResolvedValue(undefined);
  harness.query = { month: '2026-09' };
  harness.presets = [preset()];
  harness.trackers = [openProject, redmine];
  harness.presetsGate = Promise.resolve();
  harness.presetsFail = false;
  harness.secrets = { [openProject.id]: 'op-key', [redmine.id]: 'rm-key' };
  harness.csrfFetch.mockImplementation(async () => harness.presets[0]);
  adapterReturning({ [openProject.id]: [remoteLog()] });
});

describe('client report page — month (REQ-384)', () => {
  it('writes the current month in the effective time zone to the URL when missing', async () => {
    harness.query = {};
    await mountPage();

    expect(replace).toHaveBeenCalledWith({
      path: '/reports/client',
      query: { month: currentCalendarMonth(new Date(), 'UTC') },
    });
  });

  it('moves to the next and previous month', async () => {
    const wrapper = await mountPage();

    await wrapper.get('[data-testid="client-report-month-next"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/reports/client',
      query: { month: '2026-10' },
    });
    await wrapper.get('[data-testid="client-report-month-prev"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({
      path: '/reports/client',
      query: { month: '2026-08' },
    });
  });

  it('shows an error and disables export for an invalid month', async () => {
    harness.query = { month: '2026-13' };
    const wrapper = await mountPage();

    expect(wrapper.get('[data-testid="client-report-month-error"]').text()).toBe(
      'clientReport.invalidMonth',
    );
    expect(
      wrapper.get('[data-testid="client-report-export"]').attributes('disabled'),
    ).toBeDefined();
    expect(replace).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/reports/client' }));
  });
});

describe('client report page — presets (REQ-385)', () => {
  it('preselects the most recently used preset', async () => {
    harness.presets = [
      preset({ id: '01900000-0000-7000-8000-0000000000b2', clientName: 'Nordwind' }),
      preset(),
    ];
    const wrapper = await mountPage();

    const input = wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]');
    expect(input.element.value).toBe('Nordwind');
    expect(exportLabel(wrapper)).toBe('clientReport.exportButton');
  });

  it('starts an empty form with decimal hours and the UI locale on the first visit', async () => {
    harness.presets = [];
    const wrapper = await mountPage();

    const input = wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]');
    expect(input.element.value).toBe('');
    expect(
      wrapper
        .get('[data-testid="client-report-hours-format"] [role="radio"][value="decimal"]')
        .attributes('aria-checked'),
    ).toBe('true');
    expect(
      wrapper
        .get('[data-testid="client-report-locale"] [role="radio"][value="en"]')
        .attributes('aria-checked'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="client-report-delete-preset"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="client-report-preset-select"]').text()).toContain(
      'clientReport.newPreset',
    );
    expect(exportLabel(wrapper)).toBe('clientReport.saveAndExportButton');
  });

  it('resets the form when "new preset" is picked in the selector, without requests', async () => {
    const wrapper = await mountPage();

    wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'new');
    await flushPromises();

    expect(
      wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]').element.value,
    ).toBe('');
    expect(wrapper.find('[data-testid="client-report-delete-preset"]').exists()).toBe(false);
    expect(exportLabel(wrapper)).toBe('clientReport.saveAndExportButton');
    expect(harness.csrfFetch).not.toHaveBeenCalled();
  });

  it('labels export "save and export" once the selected preset is edited', async () => {
    const wrapper = await mountPage();
    expect(exportLabel(wrapper)).toBe('clientReport.exportButton');

    await wrapper.get('input[data-testid="client-report-client-name"]').setValue('Helios Solar');

    expect(exportLabel(wrapper)).toBe('clientReport.saveAndExportButton');
  });

  it('warns when trackers of the preset were deleted', async () => {
    harness.presets = [
      preset({
        trackers: [{ id: openProject.id, name: openProject.name }],
        inactiveTrackerCount: 1,
      }),
    ];
    const wrapper = await mountPage();

    expect(wrapper.get('[data-testid="client-report-inactive-warning"]').text()).toContain(
      'clientReport.inactiveTrackers',
    );
  });

  it('shows field errors and sends nothing when the form is invalid', async () => {
    harness.presets = [];
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(wrapper.text()).toContain('error.reportPresetClientNameRequired');
    expect(wrapper.text()).toContain('error.reportPresetTrackersRequired');
    expect(harness.csrfFetch).not.toHaveBeenCalled();
    expect(harness.createAdapter).not.toHaveBeenCalled();
  });

  it('deletes the selected preset only after confirmation', async () => {
    const wrapper = await mountPage();

    harness.confirm.mockResolvedValueOnce(false);
    await wrapper.get('[data-testid="client-report-delete-preset"]').trigger('click');
    await flushPromises();
    expect(harness.csrfFetch).not.toHaveBeenCalled();

    harness.presets = [];
    await wrapper.get('[data-testid="client-report-delete-preset"]').trigger('click');
    await flushPromises();
    expect(harness.csrfFetch).toHaveBeenCalledWith(
      `/api/report-presets/${preset().id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(
      wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]').element.value,
    ).toBe('');
  });
});

describe('client report page — export (REQ-386)', () => {
  it('saves the preset, fetches every tracker, and downloads the PDF in the preset locale', async () => {
    adapterReturning({
      [openProject.id]: [remoteLog()],
      [redmine.id]: [remoteLog({ remoteIssueId: '112' })],
    });
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(harness.csrfFetch).toHaveBeenCalledWith(
      `/api/report-presets/${preset().id}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(harness.createAdapter).toHaveBeenCalledTimes(2);
    // Loading the preset locale's messages and the PDF library settles after several ticks.
    await vi.waitFor(() =>
      expect(harness.download).toHaveBeenCalledWith('zestawienie-godzin-helios-energy-2026-09.pdf'),
    );
  });

  it('produces no file and names the tracker when one fetch fails', async () => {
    adapterReturning({ [openProject.id]: [remoteLog()], [redmine.id]: new Error('boom') });
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(harness.download).not.toHaveBeenCalled();
    expect(exportMessage(wrapper)).toContain('clientReport.trackerFailed');
    expect(exportMessage(wrapper)).toContain('"tracker":"Helios Redmine"');
  });

  it('stops before any tracker request when a secret is missing', async () => {
    harness.secrets = { [openProject.id]: 'op-key' };
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(harness.createAdapter).not.toHaveBeenCalled();
    expect(harness.download).not.toHaveBeenCalled();
    expect(exportMessage(wrapper)).toContain('clientReport.missingSecret');
    expect(exportMessage(wrapper)).toContain('"tracker":"Helios Redmine"');
  });

  it('reports an empty month instead of producing a file', async () => {
    adapterReturning({});
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(harness.download).not.toHaveBeenCalled();
    expect(exportMessage(wrapper)).toContain('clientReport.nothingLogged');
  });

  it('runs one export when activated twice', async () => {
    const wrapper = await mountPage();
    const form = wrapper.get('[data-testid="client-report-form"]');

    await Promise.all([form.trigger('submit'), form.trigger('submit')]);
    await vi.waitFor(() => expect(harness.download).toHaveBeenCalled());

    expect(harness.csrfFetch).toHaveBeenCalledTimes(1);
    expect(harness.download).toHaveBeenCalledTimes(1);
  });

  it('shows a duplicate client name on the field', async () => {
    harness.csrfFetch.mockRejectedValue(
      Object.assign(new Error('Conflict'), {
        data: { data: { messageKey: 'error.reportPresetClientNameDuplicate' } },
      }),
    );
    const wrapper = await mountPage();

    await submitExport(wrapper);

    expect(wrapper.text()).toContain('error.reportPresetClientNameDuplicate');
    expect(harness.createAdapter).not.toHaveBeenCalled();
  });
});

describe('client report page — loading (REQ-391)', () => {
  it('shows the skeleton instead of the form while presets load', async () => {
    harness.presetsGate = new Promise(() => {});
    const wrapper = await mountSuspended(ClientReportPage);
    await nextTick();

    expect(wrapper.find('[data-testid="client-report-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="client-report-form"]').exists()).toBe(false);
  });

  it('preselects the first preset when presets arrive after the page rendered', async () => {
    let release = () => {};
    harness.presetsGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.presets = [
      preset({ id: '01900000-0000-7000-8000-0000000000b2', clientName: 'Nordwind' }),
    ];
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="client-report-form"]').exists()).toBe(false);

    release();
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]');
    expect(input.element.value).toBe('Nordwind');
  });

  it('reports a presets load failure and still offers a new preset', async () => {
    harness.presetsFail = true;
    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="client-report-presets-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="client-report-loading"]').exists()).toBe(false);
    const input = wrapper.get<HTMLInputElement>('input[data-testid="client-report-client-name"]');
    expect(input.element.value).toBe('');
    expect(exportLabel(wrapper)).toBe('clientReport.saveAndExportButton');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import TrackerImportDialog from '../../app/components/TrackerImportDialog.vue';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ProjectDto } from '../../shared/types/project';
import type {
  ImportErrorState,
  ImportPhase,
  ImportPreview,
  ImportRunResult,
} from '../../app/composables/use-remote-log-import';

const fetchMock = vi.hoisted(() => vi.fn());
const csrfFetchMock = vi.hoisted(() => vi.fn());
const startScanMock = vi.hoisted(() => vi.fn());
const startImportMock = vi.hoisted(() => vi.fn());
const cancelScanMock = vi.hoisted(() => vi.fn());
const retryMock = vi.hoisted(() => vi.fn());
const resetMock = vi.hoisted(() => vi.fn());

// Not wrapped in `vi.hoisted`: the `mockNuxtImport` factory below only reads
// this closure when the mocked composable is actually invoked (well after
// module init), so plain source-order initialization is fine and avoids a
// TDZ reference to the `ref`/`computed` imports from a hoisted callback.
const mockState = {
  phase: ref<ImportPhase>('range'),
  scannedMonths: ref(0),
  importedMonths: ref(0),
  totalMonths: ref(0),
  preview: ref<ImportPreview>({ matched: [], unmatched: [] }),
  missingProjectIdHint: ref(false),
  result: ref<ImportRunResult | null>(null),
  errorState: ref<ImportErrorState | null>(null),
};

mockNuxtImport('useRequestFetch', () => () => fetchMock);

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      locale: { value: 'en' },
    }),
  };
});

mockNuxtImport('useUserSettings', () => () => ({
  effective: computed(() => ({ timeZone: 'UTC' })),
}));

mockNuxtImport('useRemoteLogImport', () => () => ({
  ...mockState,
  hasNothingToImport: computed(
    () =>
      mockState.preview.value.matched.length > 0 &&
      mockState.preview.value.matched.every((row) => row.wouldImport === 0),
  ),
  startScan: startScanMock,
  startImport: startImportMock,
  cancelScan: cancelScanMock,
  retry: retryMock,
  reset: resetMock,
}));

const tracker: TrackerDto = {
  id: 'tracker-1',
  name: 'Acme Tracker',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '',
  updatedAt: '',
};

function project(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'proj-1',
    name: 'Scoped Project',
    trackerId: tracker.id,
    trackerName: tracker.name,
    remoteProjectId: 'R1',
    remoteProjectTitle: 'Remote One',
    createdAt: '',
    ...overrides,
  };
}

const stubs = {
  UModal: {
    props: { open: { type: Boolean, default: true }, title: { type: String, default: '' } },
    // `data-testid` on the real usage falls through onto this stub's root,
    // so it is not declared here (it would just be overwritten).
    template:
      '<div v-if="open !== false" :aria-label="title"><slot name="body" /><slot name="footer" /></div>',
  },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UButton: {
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    template:
      '<button type="button" v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
  UProgress: { props: ['modelValue', 'max'], template: '<div role="progressbar" />' },
  UIcon: { props: ['name'], template: '<i />' },
};

function inputValue(wrapper: { find: (selector: string) => { element: Element } }, testid: string) {
  // SAFETY: the UInput stub above always renders a plain `<input>` for this testid.
  return (wrapper.find(`[data-testid="${testid}"]`).element as HTMLInputElement).value;
}

async function mount() {
  const wrapper = await mountSuspended(TrackerImportDialog, {
    props: { open: false, tracker },
    global: { stubs },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

describe('TrackerImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.phase.value = 'range';
    mockState.scannedMonths.value = 0;
    mockState.importedMonths.value = 0;
    mockState.totalMonths.value = 0;
    mockState.preview.value = { matched: [], unmatched: [] };
    mockState.missingProjectIdHint.value = false;
    mockState.result.value = null;
    mockState.errorState.value = null;
    fetchMock.mockResolvedValue([project(), project({ id: 'proj-2', remoteProjectId: null })]);
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore outside Nuxt context
    }
  });

  it("defaults the range to five years ago through today when mounted already open (matches the page's v-if usage)", async () => {
    // The real page mounts this dialog via `v-if` only once a tracker is
    // chosen, so it is created already `open: true` — there is no
    // false->true prop transition here, unlike `mount()` above. A plain
    // (non-immediate) watch on `open` would never seed the form in this case.
    const wrapper = await mountSuspended(TrackerImportDialog, {
      props: { open: true, tracker },
      global: { stubs },
    });
    await flushPromises();

    const fromValue = inputValue(wrapper, 'tracker-import-from-input');
    const toValue = inputValue(wrapper, 'tracker-import-to-input');
    expect(fromValue).toBeTruthy();
    expect(toValue).toBeTruthy();
    expect(fromValue < toValue).toBe(true);
    expect(new Date(toValue).getFullYear() - new Date(fromValue).getFullYear()).toBe(5);
  });

  it('range phase flags the unscoped project and starts a scan on submit', async () => {
    const wrapper = await mount();

    expect(wrapper.text()).toContain('Scoped Project');
    expect(wrapper.text()).toContain('trackerImport.unscopedHint');

    await wrapper.find('[data-testid="tracker-import-scan"]').trigger('click');
    expect(startScanMock).toHaveBeenCalledTimes(1);
    // SAFETY: the dialog calls startScan(range) with exactly one { from, to } argument.
    const call = startScanMock.mock.calls[0]![0] as { from: string; to: string };
    expect(call.from < call.to).toBe(true);
  });

  it('rejects an inverted range inline without starting a scan', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="tracker-import-from-input"]').setValue('2026-05-01');
    await wrapper.find('[data-testid="tracker-import-to-input"]').setValue('2026-04-01');

    await wrapper.find('[data-testid="tracker-import-scan"]').trigger('click');

    expect(wrapper.find('[data-testid="tracker-import-range-error"]').exists()).toBe(true);
    expect(startScanMock).not.toHaveBeenCalled();
  });

  it('shows scanning progress and offers cancel only while scanning', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'scanning';
    mockState.scannedMonths.value = 1;
    mockState.totalMonths.value = 3;
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-cancel-scan"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-import-back"]').exists()).toBe(false);
    await wrapper.find('[data-testid="tracker-import-cancel-scan"]').trigger('click');
    expect(cancelScanMock).toHaveBeenCalledTimes(1);
  });

  it('preview phase shows the "no scoped project" state and disables import when nothing is new', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = {
      matched: [
        { projectId: 'proj-1', wouldImport: 0, skippedExisting: 5, remoteProjectTitles: ['R1'] },
      ],
      unmatched: [{ remoteProjectId: 'R9', remoteProjectTitle: 'Sales', count: 2 }],
    };
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-row-unmatched-R9"]').text()).toContain(
      'trackerImport.noScopedProject',
    );
    const confirmButton = wrapper.find('[data-testid="tracker-import-confirm"]');
    expect(confirmButton.attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="tracker-import-nothing-to-import"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-import-cancel-scan"]').exists()).toBe(false);
  });

  it('preview phase shows the routed remote project title(s) on a matched row, not a dash', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = {
      matched: [
        {
          projectId: 'proj-1',
          wouldImport: 4,
          skippedExisting: 0,
          remoteProjectTitles: ['CMPL API', 'CMPL Web'],
        },
      ],
      unmatched: [],
    };
    await flushPromises();

    const row = wrapper.find('[data-testid="tracker-import-row-matched-proj-1"]');
    expect(row.text()).toContain('CMPL API');
    expect(row.text()).toContain('CMPL Web');
    expect(row.text()).not.toContain('—');
  });

  it('confirming the preview starts the import', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = {
      matched: [
        { projectId: 'proj-1', wouldImport: 3, skippedExisting: 0, remoteProjectTitles: ['R1'] },
      ],
      unmatched: [],
    };
    await flushPromises();

    await wrapper.find('[data-testid="tracker-import-confirm"]').trigger('click');
    expect(startImportMock).toHaveBeenCalledTimes(1);
  });

  it('done phase shows totals and the synthetic-times note', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'done';
    mockState.result.value = { totalImported: 4, totalSkippedExisting: 1, totalUnmatched: 2 };
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-done-imported"]').text()).toBe('4');
    expect(wrapper.find('[data-testid="tracker-import-done-linked"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="tracker-import-done-unmatched"]').text()).toBe('2');
    expect(wrapper.text()).toContain('trackerImport.syntheticTimesNote');
  });

  it('error phase after a failed import shows committed months and retries on demand', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'error';
    mockState.errorState.value = {
      messageKey: 'error.unknown',
      monthsCompleted: 2,
      totalMonths: 5,
      stage: 'import',
    };
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-committed-months"]').text()).toContain('2');
    await wrapper.find('[data-testid="tracker-import-retry"]').trigger('click');
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible dialog title naming the tracker', async () => {
    const wrapper = await mount();
    expect(
      wrapper.find('[data-testid="tracker-import-dialog"]').attributes('aria-label'),
    ).toContain(tracker.name);
  });
});

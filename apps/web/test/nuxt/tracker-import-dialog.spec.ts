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
  MappingRow,
  ImportRunResult,
} from '../../app/composables/use-remote-log-import';

const fetchMock = vi.hoisted(() => vi.fn());
const csrfFetchMock = vi.hoisted(() => vi.fn());
const startScanMock = vi.hoisted(() => vi.fn());
const advanceToPreviewMock = vi.hoisted(() => vi.fn());
const backToMappingMock = vi.hoisted(() => vi.fn());
const setMappingMock = vi.hoisted(() => vi.fn());
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
  mappingRows: ref<MappingRow[]>([]),
  preview: ref<ImportPreview>({ matched: [], unassignedCount: 0 }),
  missingProjectIdHint: ref(false),
  result: ref<ImportRunResult | null>(null),
  errorState: ref<ImportErrorState | null>(null),
};
// The mapping selection the mocked composable's `getMapping`/`setMapping`
// read and write, kept separate from `mockState` since it is not a ref the
// dialog watches directly — the dialog only ever calls the two functions.
let mappingSelection = new Map<string, string | null>();

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
  getMapping: (remoteProjectId: string | null) =>
    mappingSelection.get(remoteProjectId ?? '') ?? null,
  setMapping: (remoteProjectId: string | null, targetProjectId: string | null) => {
    mappingSelection.set(remoteProjectId ?? '', targetProjectId);
    setMappingMock(remoteProjectId, targetProjectId);
  },
  advanceToPreview: advanceToPreviewMock,
  backToMapping: backToMappingMock,
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
    // This single-root stub lets `data-testid` fall through onto its own
    // root the way a plain element would — the real `UModal` cannot (its
    // template has two sibling root nodes, so Vue disables attrs
    // fallthrough there), which is why the dialog's own `data-testid` lives
    // on an inner element inside `#body` instead (see TrackerImportDialog.vue).
    // `role`/`aria-label` here stand in for the real component's own
    // accessible-dialog wiring (`DialogContent role="dialog"` + `:title`).
    template:
      '<div v-if="open !== false" role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>',
  },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: {
    props: ['modelValue', 'items', 'valueKey', 'labelKey'],
    emits: ['update:modelValue'],
    template:
      '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in items" :key="opt[valueKey]" :value="opt[valueKey]">{{ opt[labelKey] }}</option></select>',
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

function selectValue(
  wrapper: { find: (selector: string) => { element: Element } },
  testid: string,
) {
  // SAFETY: the USelect stub above always renders a plain `<select>` for this testid.
  return (wrapper.find(`[data-testid="${testid}"]`).element as HTMLSelectElement).value;
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
    mappingSelection = new Map();
    mockState.phase.value = 'range';
    mockState.scannedMonths.value = 0;
    mockState.importedMonths.value = 0;
    mockState.totalMonths.value = 0;
    mockState.mappingRows.value = [];
    mockState.preview.value = { matched: [], unassignedCount: 0 };
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

  it('mapping phase lists one row per remote project, pre-selected from the default target', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'mapping';
    mockState.mappingRows.value = [
      {
        remoteProjectId: 'R1',
        remoteProjectTitle: 'Remote One',
        logCount: 3,
        defaultProjectId: 'proj-1',
      },
      { remoteProjectId: 'R9', remoteProjectTitle: 'Sales', logCount: 2, defaultProjectId: null },
    ];
    mappingSelection.set('R1', 'proj-1');
    mappingSelection.set('R9', null);
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-mapping"]').exists()).toBe(true);
    expect(selectValue(wrapper, 'tracker-import-mapping-select-R1')).toBe('proj-1');
    expect(selectValue(wrapper, 'tracker-import-mapping-select-R9')).toBe('__do-not-import__');
    expect(wrapper.find('[data-testid="tracker-import-confirm"]').exists()).toBe(false);
  });

  it('overriding a matched row calls setMapping with the newly chosen Project', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'mapping';
    mockState.mappingRows.value = [
      {
        remoteProjectId: 'R1',
        remoteProjectTitle: 'Remote One',
        logCount: 3,
        defaultProjectId: 'proj-1',
      },
    ];
    mappingSelection.set('R1', 'proj-1');
    await flushPromises();

    await wrapper.find('[data-testid="tracker-import-mapping-select-R1"]').setValue('proj-2');

    expect(setMappingMock).toHaveBeenCalledWith('R1', 'proj-2');
    expect(advanceToPreviewMock).not.toHaveBeenCalled();
  });

  it('assigning a previously unassigned row calls setMapping with the chosen Project', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'mapping';
    mockState.mappingRows.value = [
      { remoteProjectId: 'R9', remoteProjectTitle: 'Sales', logCount: 2, defaultProjectId: null },
    ];
    await flushPromises();

    await wrapper.find('[data-testid="tracker-import-mapping-select-R9"]').setValue('proj-2');

    expect(setMappingMock).toHaveBeenCalledWith('R9', 'proj-2');
  });

  it('mapping phase back returns to range without advancing, continue advances to preview', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'mapping';
    mockState.mappingRows.value = [
      {
        remoteProjectId: 'R1',
        remoteProjectTitle: 'Remote One',
        logCount: 1,
        defaultProjectId: 'proj-1',
      },
    ];
    await flushPromises();
    // `mount()` itself already triggered one `reset()` via the open watch.
    const resetCallsBeforeBack = resetMock.mock.calls.length;

    await wrapper.find('[data-testid="tracker-import-mapping-back"]').trigger('click');
    expect(resetMock.mock.calls.length).toBe(resetCallsBeforeBack + 1);
    expect(advanceToPreviewMock).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="tracker-import-mapping-continue"]').trigger('click');
    expect(advanceToPreviewMock).toHaveBeenCalledTimes(1);
  });

  it('mapping phase shows an empty state and the missing-project-id hint', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'mapping';
    mockState.mappingRows.value = [];
    mockState.missingProjectIdHint.value = true;
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-mapping-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-import-missing-project-id-hint"]').exists()).toBe(
      true,
    );
  });

  it('preview phase disables import when nothing is new and warns about unassigned logs', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = {
      matched: [
        { projectId: 'proj-1', wouldImport: 0, skippedExisting: 5, remoteProjectTitles: ['R1'] },
      ],
      unassignedCount: 2,
    };
    await flushPromises();

    expect(wrapper.find('[data-testid="tracker-import-unmatched-hint"]').text()).toContain('2');
    const confirmButton = wrapper.find('[data-testid="tracker-import-confirm"]');
    expect(confirmButton.attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="tracker-import-nothing-to-import"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-import-cancel-scan"]').exists()).toBe(false);
  });

  it('preview phase shows the routed remote project title(s) on a row, not a dash', async () => {
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
      unassignedCount: 0,
    };
    await flushPromises();

    const row = wrapper.find('[data-testid="tracker-import-preview-row-proj-1"]');
    expect(row.text()).toContain('CMPL API');
    expect(row.text()).toContain('CMPL Web');
    expect(row.text()).not.toContain('—');
  });

  it('preview back returns to mapping, not range', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = { matched: [], unassignedCount: 0 };
    await flushPromises();
    // `mount()` itself already triggered one `reset()` via the open watch.
    const resetCallsBeforeBack = resetMock.mock.calls.length;

    await wrapper.find('[data-testid="tracker-import-back"]').trigger('click');

    expect(backToMappingMock).toHaveBeenCalledTimes(1);
    expect(resetMock.mock.calls.length).toBe(resetCallsBeforeBack);
  });

  it('confirming the preview starts the import', async () => {
    const wrapper = await mount();
    mockState.phase.value = 'preview';
    mockState.preview.value = {
      matched: [
        { projectId: 'proj-1', wouldImport: 3, skippedExisting: 0, remoteProjectTitles: ['R1'] },
      ],
      unassignedCount: 0,
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
    expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toContain(tracker.name);
  });
});

import type { ComponentPublicInstance, Ref } from 'vue';

/**
 * Roving focus and one shared tooltip for a chart drawn as a `role="grid"` of cells, each cell
 * known by its index. The chart is one tab stop: the cell at `tabStop` holds it, and the chart's
 * own key handler moves it with `focusCell`. Hovering or focusing a cell shows it; the pointer may
 * move from the cell onto the tooltip, and Escape hides the tooltip until the pointer or the
 * focus moves.
 *
 * Bind `keepCell` to each cell's `ref`, and `onMouseover`, `onFocusin` and `onFocusout` to the
 * grid. `cellOf` finds the cell of any other event the grid listens for.
 */
export function useChartCells({
  grid,
  tooltip,
  initialTabStop = 0,
}: {
  grid: Readonly<Ref<HTMLElement | null>>;
  tooltip: Readonly<Ref<HTMLElement | null>>;
  initialTabStop?: number;
}) {
  const tabStop = ref(initialTabStop);
  const hovered = ref<number | null>(null);
  const focused = ref<number | null>(null);
  const dismissed = ref(false);
  const cellElements: (HTMLElement | undefined)[] = [];

  const shownIndex = computed(() => (dismissed.value ? null : (hovered.value ?? focused.value)));
  const shownElement = computed(() =>
    shownIndex.value === null ? undefined : cellElements[shownIndex.value],
  );

  function keepCell(element: Element | ComponentPublicInstance | null, index: number): void {
    if (element instanceof HTMLElement) cellElements[index] = element;
  }

  /** The index of the cell an event comes from, if any. */
  function cellOf(event: Event): number | null {
    const cell = event.target instanceof Element ? event.target.closest('[role="gridcell"]') : null;
    const index = cellElements.findIndex((element) => element !== undefined && element === cell);
    return index === -1 ? null : index;
  }

  function hover(index: number | null): void {
    if (index === hovered.value) return;
    hovered.value = index;
    dismissed.value = false;
  }

  function onMouseover(event: MouseEvent): void {
    hover(cellOf(event));
  }

  /** The pointer may move from a cell onto its tooltip, so that it can be read there. */
  function leave(event: Event): void {
    if (hovered.value === null) return;
    const target = event.target;
    const inside = [grid.value, tooltip.value].some(
      (element) => target instanceof Node && element?.contains(target),
    );
    if (!inside) hover(null);
  }

  // Escape hides the tooltip wherever the focus is, also one shown by the pointer.
  function dismiss(event: KeyboardEvent): void {
    if (event.key === 'Escape' && shownIndex.value !== null) dismissed.value = true;
  }

  onMounted(() => {
    window.addEventListener('pointerover', leave);
    window.addEventListener('keydown', dismiss);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('pointerover', leave);
    window.removeEventListener('keydown', dismiss);
  });

  function onFocusin(event: FocusEvent): void {
    const index = cellOf(event);
    if (index === null) return;
    tabStop.value = index;
    focused.value = index;
    dismissed.value = false;
  }

  function onFocusout(): void {
    focused.value = null;
  }

  function focusCell(index: number): void {
    cellElements[index]?.focus();
  }

  return {
    tabStop: readonly(tabStop),
    shownIndex,
    shownElement,
    keepCell,
    cellOf,
    onMouseover,
    onFocusin,
    onFocusout,
    focusCell,
  };
}

import type { ComponentPublicInstance, MaybeRefOrGetter, Ref } from 'vue';

/** How far the arrow keys move between cells; no `down` leaves the up and down arrows alone. */
export interface CellSteps {
  right: number;
  down?: number;
}

/**
 * Roving focus and one shared tooltip for a chart drawn as a `role="grid"` of cells, each cell
 * known by its index. The chart is one tab stop: the cell at `tabStop` holds it, and `moveFocus`
 * moves it by the arrow keys as `steps` says, and to the first and the last cell by Home and End.
 * Hovering or focusing a cell shows it; the pointer may move from the cell onto the tooltip, and
 * Escape hides the tooltip until the pointer or the focus moves.
 *
 * Bind `keepCell` to each cell's `ref`, and `moveFocus` (or a key handler that calls it),
 * `onMouseover`, `onFocusin` and `onFocusout` to the grid. `cellOf` finds the cell of any other
 * event the grid listens for.
 */
export function useChartCells({
  grid,
  tooltip,
  count,
  steps,
  initialTabStop = 0,
}: {
  grid: Readonly<Ref<HTMLElement | null>>;
  tooltip: Readonly<Ref<HTMLElement | null>>;
  count: MaybeRefOrGetter<number>;
  steps: MaybeRefOrGetter<CellSteps>;
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

  /** A move past the first or the last cell keeps the focus where it is. */
  function moveFocus(event: KeyboardEvent): void {
    const from = tabStop.value;
    const { right, down } = toValue(steps);
    const last = toValue(count) - 1;
    const targets = new Map([
      ['ArrowLeft', from - right],
      ['ArrowRight', from + right],
      ['Home', 0],
      ['End', last],
    ]);
    if (down !== undefined) {
      targets.set('ArrowUp', from - down);
      targets.set('ArrowDown', from + down);
    }
    const target = targets.get(event.key);
    if (target === undefined) return;
    event.preventDefault();
    if (target >= 0 && target <= last) cellElements[target]?.focus();
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
    moveFocus,
  };
}

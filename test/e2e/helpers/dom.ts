/**
 * True when `text` appears in the document body OR in any input/textarea value.
 * Needed after inline-edit controls switched from button labels to UInput values.
 */
export function pageIncludesTextScript(): (text: string) => boolean {
  return (text: string) => {
    if (document.body.textContent?.includes(text)) return true;
    for (const el of document.querySelectorAll('input, textarea')) {
      if ((el as HTMLInputElement).value?.includes(text)) return true;
    }
    return false;
  };
}

/** Inverse of {@link pageIncludesTextScript}. */
export function pageExcludesTextScript(): (text: string) => boolean {
  return (text: string) => {
    if (document.body.textContent?.includes(text)) return false;
    for (const el of document.querySelectorAll('input, textarea')) {
      if ((el as HTMLInputElement).value?.includes(text)) return false;
    }
    return true;
  };
}

/**
 * Browser-side helper: resolve a timer-group root key from a display title value.
 * Avoids matching nested `timer-group-title-*` testids via naive `closest`.
 */
export function groupKeyForTitleScript(): (title: string) => string | null {
  return (title: string) => {
    const titles = [
      ...document.querySelectorAll(
        '[data-testid^="timer-group-title-"]:not([data-testid*="title-input"])',
      ),
    ];
    const titleNode = titles.find((node) => {
      const input = (
        node.matches('input') ? node : node.querySelector('input')
      ) as HTMLInputElement | null;
      return input?.value === title;
    });
    if (!titleNode) return null;
    let node: Element | null = titleNode;
    while (node) {
      const tid = node.getAttribute('data-testid');
      if (tid && /^timer-group-(untitled|[0-9a-f-]{36})$/i.test(tid)) {
        return tid.slice('timer-group-'.length);
      }
      node = node.parentElement;
    }
    return null;
  };
}

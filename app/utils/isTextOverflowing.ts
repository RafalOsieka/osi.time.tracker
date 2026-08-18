function isFormTextControl(el: Element): boolean {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function boxOf(el: Element): { scrollWidth: number; clientWidth: number } | null {
  const candidate = el as Element & { scrollWidth?: unknown; clientWidth?: unknown };
  if (typeof candidate.scrollWidth !== 'number' || typeof candidate.clientWidth !== 'number') {
    return null;
  }
  return { scrollWidth: candidate.scrollWidth, clientWidth: candidate.clientWidth };
}

/** True when the element's (or nested input's) text is wider than its box. */
export function isTextOverflowing(host: Element, slackPx = 1): boolean {
  const nested = host.querySelector?.('input, textarea') ?? null;
  const el = isFormTextControl(host) ? host : (nested ?? host);
  const box = boxOf(el);
  if (!box) return false;
  return box.scrollWidth > box.clientWidth + slackPx;
}

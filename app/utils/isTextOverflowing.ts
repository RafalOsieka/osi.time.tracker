export type OverflowBox = {
  tagName: string;
  scrollWidth: number;
  clientWidth: number;
  querySelector?: (selectors: string) => OverflowBox | null;
};

function isFormTextControl(el: OverflowBox): boolean {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

/** True when the element's (or nested input's) text is wider than its box. */
export function isTextOverflowing(host: OverflowBox, slackPx = 1): boolean {
  const nested = host.querySelector?.('input, textarea') ?? null;
  const el = isFormTextControl(host) ? host : (nested ?? host);
  return el.scrollWidth > el.clientWidth + slackPx;
}

/** Layout box used for overflow measurement. `HTMLElement` is assignable. */
export type OverflowHost = {
  tagName: string;
  scrollWidth: number;
  clientWidth: number;
  querySelector(selectors: string): OverflowHost | null;
};

function isFormTextControl(el: OverflowHost): boolean {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

/** True when the element's (or nested input's) text is wider than its box. */
export function isTextOverflowing(host: OverflowHost, slackPx = 1): boolean {
  const nested = host.querySelector('input, textarea');
  const el = isFormTextControl(host) ? host : (nested ?? host);
  return el.scrollWidth > el.clientWidth + slackPx;
}

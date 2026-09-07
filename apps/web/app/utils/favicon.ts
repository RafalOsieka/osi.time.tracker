/** SVG favicon href for idle vs running timer state (REQ-268). */
export function faviconSvgHref(isRunning: boolean): string {
  return isRunning ? '/favicon-running.svg' : '/favicon.svg';
}

/**
 * Document icon links. The ICO keeps `sizes="32x32"` so Chromium prefers the
 * SVG (without it, Chrome always displays `/favicon.ico` and the running
 * badge never appears). Distinct Unhead keys force the SVG `<link>` to be
 * replaced on start/stop so the tab actually loads the new URL.
 */
export function faviconHeadLinks(isRunning: boolean) {
  return [
    {
      rel: 'icon' as const,
      type: 'image/x-icon',
      href: '/favicon.ico',
      sizes: '32x32',
      key: 'favicon-ico',
    },
    {
      rel: 'icon' as const,
      type: 'image/svg+xml',
      href: faviconSvgHref(isRunning),
      key: isRunning ? 'favicon-svg-running' : 'favicon-svg-idle',
    },
  ];
}

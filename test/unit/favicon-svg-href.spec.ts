import { describe, expect, it } from 'vitest';
import { faviconHeadLinks, faviconSvgHref } from '../../app/utils/favicon';

describe('faviconSvgHref', () => {
  it('returns the default SVG when idle', () => {
    expect(faviconSvgHref(false)).toBe('/favicon.svg');
  });

  it('returns the running SVG when a timer is running', () => {
    expect(faviconSvgHref(true)).toBe('/favicon-running.svg');
  });
});

describe('faviconHeadLinks', () => {
  it('puts a sized ICO first so Chromium prefers the idle SVG', () => {
    expect(faviconHeadLinks(false)).toEqual([
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
        sizes: '32x32',
        key: 'favicon-ico',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
        key: 'favicon-svg-idle',
      },
    ]);
  });

  it('swaps the SVG href and Unhead key when running', () => {
    expect(faviconHeadLinks(true)).toEqual([
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
        sizes: '32x32',
        key: 'favicon-ico',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon-running.svg',
        key: 'favicon-svg-running',
      },
    ]);
  });
});

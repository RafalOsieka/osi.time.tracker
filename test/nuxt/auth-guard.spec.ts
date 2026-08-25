import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { RouteLocationNormalized } from 'vue-router';

const { sessionState, navigateToMock } = vi.hoisted(() => ({
  sessionState: { loggedIn: { value: false } },
  navigateToMock: vi.fn((target: string | RouteLocationNormalized) => target),
}));

mockNuxtImport('useUserSession', () => () => sessionState);
mockNuxtImport('navigateTo', () => navigateToMock);

// Imported after the mocks are registered so the middleware picks them up.
const { default: authGuard } = await import('../../app/middleware/auth.global');

function route(partial: Partial<RouteLocationNormalized>): RouteLocationNormalized {
  // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
  return {
    path: '/',
    fullPath: '/',
    query: {},
    meta: {},
    ...partial,
  } as RouteLocationNormalized;
}

const from = route({});

beforeEach(() => {
  sessionState.loggedIn.value = false;
  navigateToMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('auth.global middleware', () => {
  it('redirects an unauthenticated visitor on / to /login?redirect=/', () => {
    authGuard(route({ path: '/', fullPath: '/' }), from);
    expect(navigateToMock).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/' } });
  });

  it('preserves a deep link through the login round-trip', () => {
    // 1. Unauthenticated deep link is stashed on the login redirect.
    authGuard(route({ path: '/trackers/5', fullPath: '/trackers/5' }), from);
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/trackers/5' },
    });

    // 2. After authentication, hitting /login with that redirect returns to it.
    navigateToMock.mockClear();
    sessionState.loggedIn.value = true;
    authGuard(
      route({
        path: '/login',
        fullPath: '/login?redirect=/trackers/5',
        query: { redirect: '/trackers/5' },
      }),
      from,
    );
    expect(navigateToMock).toHaveBeenCalledWith('/trackers/5');
  });

  it('redirects an authenticated user away from /login to / when no redirect is present', () => {
    sessionState.loggedIn.value = true;
    authGuard(route({ path: '/login', fullPath: '/login' }), from);
    expect(navigateToMock).toHaveBeenCalledWith('/');
  });

  it('rejects an open-redirect attempt and falls back to /', () => {
    sessionState.loggedIn.value = true;
    authGuard(
      route({ path: '/login', fullPath: '/login', query: { redirect: '//evil.com' } }),
      from,
    );
    expect(navigateToMock).toHaveBeenCalledWith('/');
  });

  it('lets an authenticated user reach a private route untouched', () => {
    sessionState.loggedIn.value = true;
    const result = authGuard(route({ path: '/trackers', fullPath: '/trackers' }), from);
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('lets an unauthenticated visitor reach a public route untouched', () => {
    const result = authGuard(
      route({ path: '/login', fullPath: '/login', meta: { public: true } }),
      from,
    );
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

/**
 * Thin wrapper around nuxt-auth-utils' `useUserSession` that also exposes
 * CSRF-aware login/logout actions. The UI consumes `loggedIn` / `user` for
 * conditional rendering and calls `login` / `logout` for the auth flow.
 */
export function useAuth() {
  const { loggedIn, user, fetch: refresh, clear } = useUserSession();
  const { $csrfFetch } = useNuxtApp();

  async function login(credentials: { email: string; password: string }) {
    await $csrfFetch('/api/auth/login', { method: 'POST', body: credentials });
    await refresh();
  }

  async function logout() {
    await $csrfFetch('/api/auth/logout', { method: 'POST' });
    // Refresh local session state so the UI reflects the logged-out state.
    await refresh().catch(() => clear());
  }

  return { loggedIn, user, login, logout, refresh };
}

/** Shape of the authenticated user exposed to the UI by the session. */
export interface SessionUser {
  email?: string | null;
  displayName?: string | null;
}

/** Return value of {@link authStatusKey} — a message key and optional params for `t()`. */
export interface AuthStatusMessage {
  key: string;
  params?: Record<string, string>;
}

/**
 * Pure, UI-agnostic helper that derives the i18n message key (and params) for
 * the auth status label shown to the user. Kept free of Vue/Nuxt so it can be
 * unit tested in isolation (see `test/unit/auth-display.spec.ts`).
 */
export function authStatusKey(loggedIn: boolean, user?: SessionUser | null): AuthStatusMessage {
  if (!loggedIn) {
    return { key: 'home.statusLoggedOut' };
  }
  const name = user?.displayName?.trim() || user?.email?.trim();
  return name ? { key: 'home.statusLoggedInAs', params: { name } } : { key: 'home.statusLoggedIn' };
}

/** Shape of the authenticated user exposed to the UI by the session. */
export interface SessionUser {
  name?: string | null;
}

/**
 * Pure, UI-agnostic helper that derives the greeting/label shown to the user
 * from the current login state. Kept free of Vue/Nuxt so it can be unit tested
 * in isolation (see `test/unit/auth-display.spec.ts`).
 */
export function authStatusLabel(loggedIn: boolean, user?: SessionUser | null): string {
  if (!loggedIn) {
    return 'You are not logged in';
  }
  const name = user?.name?.trim();
  return name ? `Logged in as ${name}` : 'Logged in';
}

// Reloads an open tab on return when the access layer in front of the app has expired
// (core-authentication REQ-533). Without such a layer the session request never redirects.
export default defineNuxtPlugin(() => {
  const probe = createAccessSessionProbe({
    fetchSession: () => fetch('/api/auth/session', { redirect: 'manual', cache: 'no-store' }),
    reload: () => window.location.reload(),
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe();
  });
});

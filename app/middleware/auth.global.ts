/**
 * Private-by-default navigation guard.
 *
 * Every route is treated as private unless the matched page declares
 * `definePageMeta({ public: true })`. The guard reads the session via
 * `useUserSession().loggedIn`, which resolves during SSR from the session
 * cookie, so protected markup is never painted for unauthenticated users and
 * the guard never touches browser-only APIs (`window`, `localStorage`, ...).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  const isPublic = to.meta.public === true;

  if (!loggedIn.value && !isPublic) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  if (loggedIn.value && to.path === '/login') {
    return navigateTo(sanitizeRedirect(to.query.redirect));
  }
});

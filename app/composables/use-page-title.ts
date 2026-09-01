/**
 * Sets the Unhead page title segment. Combined with app.vue `titleTemplate`
 * into `{page} | {layout.title}`. Pass a getter so locale changes recompute.
 */
export function usePageTitle(title: MaybeRefOrGetter<string>) {
  useHead({
    title: computed(() => toValue(title)),
  });
}

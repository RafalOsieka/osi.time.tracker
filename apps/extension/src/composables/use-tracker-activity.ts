import { onScopeDispose, readonly, shallowRef } from 'vue';
import {
  createChromeActivityStore,
  type ActivityMap,
  type ActivityStore,
} from '../activity/activity-store.js';

const CLOCK_INTERVAL_MS = 30_000;

/**
 * Latest tracker activity per destination for an extension page, kept current through storage
 * changes, plus a coarse clock so relative times ("2 minutes ago") move on while the page is open.
 */
export function useTrackerActivity(store: ActivityStore = createChromeActivityStore()) {
  const activity = shallowRef<ActivityMap>({});
  const now = shallowRef(Date.now());

  void store
    .load()
    .then((loaded) => {
      activity.value = loaded;
    })
    .catch(() => {
      // Activity is diagnostic only; rows fall back to "no activity yet".
    });
  const unsubscribe = store.subscribe((next) => {
    activity.value = next;
    now.value = Date.now();
  });
  const clock = setInterval(() => {
    now.value = Date.now();
  }, CLOCK_INTERVAL_MS);
  onScopeDispose(() => {
    unsubscribe();
    clearInterval(clock);
  });

  return { activity: readonly(activity), now: readonly(now) };
}

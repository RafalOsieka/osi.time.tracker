import type { TimerViewFeedDto, TimerViewFeedQuery } from '../../shared/types/time-entry';

/** Client fetch of one timer-view feed page: newest, older (`before`), or a range (`from`). */
export function fetchTimerViewFeed(query: TimerViewFeedQuery = {}): Promise<TimerViewFeedDto> {
  return $fetch<TimerViewFeedDto>('/api/time-entries/feed', { query });
}

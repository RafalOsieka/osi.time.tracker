import type { TimerViewFeedDto } from '../../shared/types/time-entry';

export function fetchTimerViewFeed(before?: string): Promise<TimerViewFeedDto> {
  return $fetch<TimerViewFeedDto>(
    '/api/time-entries/feed',
    before ? { query: { before } } : undefined,
  );
}

import { ref } from 'vue';
import type { DestinationSelector } from '@osi/extension-protocol';
import { suggestExtensionDestination } from '~/utils/remote/extension-suggestion';

export type ExtensionSuggestionState =
  | { status: 'sending' }
  | { status: 'queued' }
  | { status: 'failed'; messageKey: string };

/** Stable key of a destination for per-tracker request state. */
export function suggestionKey(destination: DestinationSelector): string {
  return `${destination.provider}|${destination.baseUrl}`;
}

/**
 * "Request approval in the extension" for unapproved trackers (REQ-316, REQ-317). An already
 * approved destination needs nothing from the user, so it triggers `onAlreadyApproved` (a
 * readiness recheck) instead of a message.
 */
export function useExtensionSuggestion(
  onAlreadyApproved: () => void | Promise<void>,
  suggest: typeof suggestExtensionDestination = suggestExtensionDestination,
) {
  const states = ref<Record<string, ExtensionSuggestionState>>({});

  async function request(destination: DestinationSelector): Promise<void> {
    const key = suggestionKey(destination);
    states.value = { ...states.value, [key]: { status: 'sending' } };
    const outcome = await suggest(destination);
    if (outcome.status === 'alreadyApproved') {
      const { [key]: _done, ...rest } = states.value;
      states.value = rest;
      await onAlreadyApproved();
      return;
    }
    states.value = { ...states.value, [key]: outcome };
  }

  return { states, request };
}

import { EXTENSION_ERROR_MESSAGE_KEYS, ExtensionProtocolError } from '@osi/extension-protocol';
import { trackerSystemTypeSchema, type TrackerSystemType } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import {
  destinationKey,
  type ApprovalService,
  type DestinationApproval,
} from '../approvals/approvals.js';
import { CanonicalizationError, canonicalizeDestination } from '../security/canonicalize.js';

export const SUGGESTION_STORAGE_KEY = 'osi.suggestions';
const SUGGESTION_LOCK = 'osi-extension-suggestions';

/** Pending suggestions are never evicted; a website past this bound gets a limit error. */
export const MAX_PENDING_SUGGESTIONS = 10;

const suggestionSchema = z.object({
  websiteOrigin: z.string().min(1),
  provider: trackerSystemTypeSchema,
  origin: z.string().min(1),
  basePath: z.string(),
  suggestedAt: z.iso.datetime(),
});

const suggestionListSchema = z.array(suggestionSchema);

/**
 * A tracker destination an approved website asked the user to approve. It is untrusted input
 * until the user approves it, so it lives apart from the approvals themselves.
 */
export type DestinationSuggestion = z.infer<typeof suggestionSchema>;

export interface SuggestionStore {
  load(): Promise<DestinationSuggestion[]>;
  save(suggestions: readonly DestinationSuggestion[]): Promise<void>;
  subscribe(listener: (suggestions: DestinationSuggestion[]) => void): () => void;
}

function parseSuggestions(value: ChromeJson | undefined): DestinationSuggestion[] {
  const parsed = suggestionListSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function createChromeSuggestionStore(
  storage: ChromeStorageArea = chrome.storage.local,
  changes: ChromeStorageChanges = chrome.storage.onChanged,
): SuggestionStore {
  return {
    load: async () =>
      parseSuggestions((await storage.get(SUGGESTION_STORAGE_KEY))[SUGGESTION_STORAGE_KEY]),
    save: async (suggestions) => {
      const payload = suggestionListSchema.parse(suggestions);
      // SAFETY: parsed suggestions hold only strings, so they are a JSON storage payload.
      await storage.set({ [SUGGESTION_STORAGE_KEY]: payload as ChromeJson });
    },
    subscribe: (listener) => {
      const onChanged: Parameters<ChromeStorageChanges['addListener']>[0] = (changed, area) => {
        if (area !== 'local' || !(SUGGESTION_STORAGE_KEY in changed)) return;
        listener(parseSuggestions(changed[SUGGESTION_STORAGE_KEY]?.newValue));
      };
      changes.addListener(onChanged);
      return () => changes.removeListener(onChanged);
    },
  };
}

export function createMemorySuggestionStore(): SuggestionStore {
  let current: DestinationSuggestion[] = [];
  const listeners = new Set<(suggestions: DestinationSuggestion[]) => void>();
  return {
    load: async () => [...current],
    save: async (suggestions) => {
      current = [...suggestions];
      for (const listener of listeners) listener([...current]);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Stable id of a suggestion; the same as the approval it would become. */
export function suggestionId(suggestion: DestinationSuggestion): string {
  return destinationKey(suggestion);
}

/**
 * Queues tracker destinations suggested by approved websites for the user's review, and turns an
 * accepted one into a regular destination approval (permission prompt included).
 */
export class SuggestionService {
  constructor(
    private readonly store: SuggestionStore,
    private readonly approvals: ApprovalService,
  ) {}

  list(): Promise<DestinationSuggestion[]> {
    return this.store.load();
  }

  subscribe(listener: (suggestions: DestinationSuggestion[]) => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Queues a suggestion from an already verified website origin. Throws `CanonicalizationError`
   * for an invalid destination or an unapproved website, and a `limit` protocol error when full.
   */
  async suggest(
    websiteOrigin: string,
    provider: TrackerSystemType,
    baseUrl: string,
  ): Promise<'queued' | 'alreadyApproved'> {
    const destination = canonicalizeDestination(baseUrl);
    const candidate: DestinationApproval = {
      websiteOrigin,
      provider,
      origin: destination.origin,
      basePath: destination.pathname,
    };
    const key = destinationKey(candidate);
    const state = await this.approvals.list();
    if (!state.websites.some((item) => item.origin === websiteOrigin)) {
      throw new CanonicalizationError('error.extensionOriginUnapproved');
    }
    if (state.destinations.some((item) => destinationKey(item) === key)) return 'alreadyApproved';
    return this.update<'queued'>((pending) => {
      if (pending.some((item) => suggestionId(item) === key)) return { pending, result: 'queued' };
      if (pending.length >= MAX_PENDING_SUGGESTIONS) {
        throw new ExtensionProtocolError('limit', EXTENSION_ERROR_MESSAGE_KEYS.limit);
      }
      const suggestion = { ...candidate, suggestedAt: new Date().toISOString() };
      return { pending: [...pending, suggestion], result: 'queued' };
    });
  }

  dismiss(id: string): Promise<void> {
    return this.update((pending) => ({
      pending: pending.filter((item) => suggestionId(item) !== id),
      result: undefined,
    }));
  }

  /**
   * Approves the suggested destination for its website. The browser permission prompt runs
   * inside, so call it from a user gesture; when it is denied the suggestion stays pending.
   */
  async approve(id: string): Promise<void> {
    const suggestion = (await this.store.load()).find((item) => suggestionId(item) === id);
    if (!suggestion) return;
    await this.approvals.approveDestination(
      suggestion.websiteOrigin,
      suggestion.provider,
      `${suggestion.origin}${suggestion.basePath}`,
    );
    await this.dismiss(id);
  }

  /** Drops suggestions whose website is no longer approved or whose destination now is. */
  async prune(): Promise<void> {
    const state = await this.approvals.list();
    const websites = new Set(state.websites.map((item) => item.origin));
    const approved = new Set(state.destinations.map(destinationKey));
    await this.update((pending) => ({
      pending: pending.filter(
        (item) => websites.has(item.websiteOrigin) && !approved.has(suggestionId(item)),
      ),
      result: undefined,
    }));
  }

  private update<Result>(
    change: (pending: DestinationSuggestion[]) => {
      pending: DestinationSuggestion[];
      result: Result;
    },
  ): Promise<Result> {
    return navigator.locks.request(SUGGESTION_LOCK, async () => {
      const current = await this.store.load();
      const { pending, result } = change(current);
      const changed =
        pending.length !== current.length || pending.some((item, index) => item !== current[index]);
      // Pruning runs on every approval change; skip writes that would only wake listeners.
      if (changed) await this.store.save(pending);
      return result;
    });
  }
}

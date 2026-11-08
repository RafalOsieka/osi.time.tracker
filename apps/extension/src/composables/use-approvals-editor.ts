import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef, watch } from 'vue';
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';
import type {
  ApprovalService,
  DestinationApproval,
  WebsiteApproval,
} from '../approvals/approvals.js';
import {
  CanonicalizationError,
  canonicalizeDestination,
  canonicalizeWebsiteOrigin,
  isHttpCredentialRisk,
} from '../security/canonicalize.js';
import { displayDestination, displayUrl } from '../approvals/display.js';
import type { MessageParams } from '../i18n/translate.js';
import {
  suggestionId,
  type DestinationSuggestion,
  type SuggestionService,
} from '../suggestions/suggestions.js';

/**
 * Why a website address cannot be approved, as the one rule it breaks: no full address, sign-in
 * details in it, plain HTTP outside loopback, or more than the bare origin.
 */
function websiteProblem(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return 'approvals.invalidWebsiteFormat';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'approvals.invalidWebsiteFormat';
  }
  if (url.username !== '' || url.password !== '') return 'approvals.invalidWebsiteCredentials';
  try {
    canonicalizeWebsiteOrigin(url.origin);
  } catch {
    return 'approvals.invalidWebsiteHttp';
  }
  return 'approvals.invalidWebsitePath';
}

export interface ApprovalsEditorOptions {
  /** Re-registers the website bridge for the approved origins that have browser access. */
  reconcile?: (origins: readonly string[]) => Promise<void>;
  /**
   * Announces a completed change (for example as a toast); `params.name` names the approval it
   * touched. Failures stay in `errorKey`.
   */
  onOutcome?: (messageKey: string, params: MessageParams) => void;
  /** Pending tracker suggestions to list, approve and dismiss next to the approvals. */
  suggestions?: SuggestionService;
}

/**
 * Approval state and actions shared by the popup and the setup page. Successes are reported once
 * through `onOutcome`; errors that need the user stay in `errorKey` until resolved.
 */
export function useApprovalsEditor(service: ApprovalService, options: ApprovalsEditorOptions = {}) {
  const websites = shallowRef<WebsiteApproval[]>([]);
  const destinations = shallowRef<DestinationApproval[]>([]);
  const websiteOrigin = shallowRef('');
  const destinationWebsite = shallowRef('');
  const destinationProvider = shallowRef<TrackerSystemType>('openproject');
  const destinationUrl = shallowRef('');
  const errorKey = shallowRef<string | null>(null);
  const websiteErrorKey = shallowRef<string | null>(null);
  const destinationErrorKey = shallowRef<string | null>(null);
  const missingOrigins = shallowRef<string[]>([]);
  const busy = shallowRef(false);
  const loaded = shallowRef(false);
  const suggestions = shallowRef<DestinationSuggestion[]>([]);
  let refreshVersion = 0;

  watch(
    websiteOrigin,
    () => {
      websiteErrorKey.value = null;
    },
    { flush: 'sync' },
  );
  watch(
    destinationUrl,
    () => {
      destinationErrorKey.value = null;
    },
    { flush: 'sync' },
  );

  if (getCurrentScope()) {
    const unsubscribe = service.subscribe(() => {
      void refresh();
    });
    const unsubscribeSuggestions = options.suggestions?.subscribe((next) => {
      suggestions.value = next;
    });
    onScopeDispose(() => {
      unsubscribe();
      unsubscribeSuggestions?.();
      refreshVersion++;
    });
  }

  const httpWarning = computed(() => {
    try {
      return isHttpCredentialRisk(canonicalizeDestination(destinationUrl.value));
    } catch {
      return false;
    }
  });

  async function refresh(): Promise<void> {
    const version = ++refreshVersion;
    try {
      const [state, pending] = await Promise.all([
        service.list(),
        options.suggestions?.list() ?? Promise.resolve([]),
      ]);
      const origins = [
        ...new Set([
          ...state.websites.map((item) => item.origin),
          ...state.destinations.map((item) => item.origin),
        ]),
      ];
      const granted = await Promise.all(origins.map((origin) => service.hasHostPermission(origin)));
      if (version !== refreshVersion) return;
      suggestions.value = pending;
      websites.value = state.websites;
      destinations.value = state.destinations;
      missingOrigins.value = origins.filter((_, index) => !granted[index]);
      loaded.value = true;
      if (errorKey.value === 'approvals.loadFailed') errorKey.value = null;
      if (!state.websites.some((item) => item.origin === destinationWebsite.value)) {
        destinationWebsite.value = state.websites[0]?.origin ?? '';
      }
      try {
        await options.reconcile?.(
          state.websites
            .filter((item) => !missingOrigins.value.includes(item.origin))
            .map((item) => item.origin),
        );
        if (version === refreshVersion && errorKey.value === 'approvals.setupFailed') {
          errorKey.value = null;
        }
      } catch {
        if (version === refreshVersion) errorKey.value ??= 'approvals.setupFailed';
      }
    } catch {
      if (version !== refreshVersion) return;
      loaded.value = false;
      errorKey.value = 'approvals.loadFailed';
    }
  }

  async function addWebsite(): Promise<void> {
    if (busy.value) return;
    errorKey.value = null;
    let origin: string;
    try {
      origin = canonicalizeWebsiteOrigin(websiteOrigin.value).origin;
    } catch {
      websiteErrorKey.value = websiteProblem(websiteOrigin.value);
      return;
    }
    await runChange(
      async () => {
        await service.approveWebsite(websiteOrigin.value);
        websiteOrigin.value = '';
      },
      'approvals.websiteApproved',
      displayUrl(origin),
    );
  }

  async function revokeWebsite(origin: string): Promise<void> {
    await runChange(
      () => service.revokeWebsite(origin),
      'approvals.websiteRemoved',
      displayUrl(origin),
    );
  }

  async function addDestination(): Promise<void> {
    if (busy.value) return;
    errorKey.value = null;
    let href: string;
    try {
      href = canonicalizeDestination(destinationUrl.value).href;
    } catch {
      destinationErrorKey.value = 'approvals.invalidDestination';
      return;
    }
    if (!websites.value.some((item) => item.origin === destinationWebsite.value)) {
      errorKey.value = 'approvals.websiteRequired';
      return;
    }
    await runChange(
      async () => {
        await service.approveDestination(
          destinationWebsite.value,
          destinationProvider.value,
          destinationUrl.value,
        );
        destinationUrl.value = '';
      },
      'approvals.trackerApproved',
      displayUrl(href),
    );
  }

  async function revokeDestination(approval: DestinationApproval): Promise<void> {
    await runChange(
      () => service.revokeDestination(approval),
      'approvals.trackerRemoved',
      displayDestination(approval),
    );
  }

  async function restoreWebsite(origin: string): Promise<void> {
    await runChange(
      async () => {
        await service.approveWebsite(origin);
      },
      'approvals.accessRestored',
      displayUrl(origin),
    );
  }

  async function restoreDestination(approval: DestinationApproval): Promise<void> {
    await runChange(
      async () => {
        await service.approveDestination(
          approval.websiteOrigin,
          approval.provider,
          `${approval.origin}${approval.basePath}`,
        );
      },
      'approvals.accessRestored',
      displayDestination(approval),
    );
  }

  /** The address of a pending suggestion, for the outcome message. */
  function suggestionName(id: string): string {
    const item = suggestions.value.find((suggestion) => suggestionId(suggestion) === id);
    return item ? displayDestination(item) : '';
  }

  /** Approves a suggested tracker; runs the permission prompt, so call it from a click. */
  async function approveSuggestion(id: string): Promise<void> {
    const queue = options.suggestions;
    if (queue) {
      await runChange(() => queue.approve(id), 'approvals.trackerApproved', suggestionName(id));
    }
  }

  async function dismissSuggestion(id: string): Promise<void> {
    const queue = options.suggestions;
    if (queue) {
      await runChange(() => queue.dismiss(id), 'approvals.suggestionDismissed', suggestionName(id));
    }
  }

  async function retry(): Promise<void> {
    await runChange(() => service.reconcile(), 'approvals.repaired', '');
  }

  async function runChange(
    action: () => Promise<void>,
    successKey: string,
    name: string,
  ): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    errorKey.value = null;
    try {
      await action();
      options.onOutcome?.(successKey, { name });
    } catch (error) {
      errorKey.value =
        error instanceof CanonicalizationError
          ? error.messageKey === 'error.extensionPermissionRequired'
            ? 'approvals.denied'
            : error.messageKey
          : 'approvals.changeFailed';
    } finally {
      await refresh();
      busy.value = false;
    }
  }

  return {
    websites: readonly(websites),
    destinations: readonly(destinations),
    websiteOrigin,
    destinationWebsite,
    destinationProvider,
    destinationUrl,
    errorKey: readonly(errorKey),
    websiteErrorKey: readonly(websiteErrorKey),
    destinationErrorKey: readonly(destinationErrorKey),
    missingOrigins: readonly(missingOrigins),
    busy: readonly(busy),
    loaded: readonly(loaded),
    httpWarning,
    refresh,
    addWebsite,
    revokeWebsite,
    addDestination,
    revokeDestination,
    restoreWebsite,
    restoreDestination,
    retry,
    suggestions: readonly(suggestions),
    approveSuggestion,
    dismissSuggestion,
  };
}

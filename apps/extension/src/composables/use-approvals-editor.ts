import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef, watch } from 'vue';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
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

export interface ContentScriptPort {
  reconcile: (origins: readonly string[]) => Promise<void>;
}

const noopScripts: ContentScriptPort = {
  reconcile: async () => {},
};

export function useApprovalsEditor(
  service: ApprovalService,
  scripts: ContentScriptPort = noopScripts,
) {
  const websites = shallowRef<WebsiteApproval[]>([]);
  const destinations = shallowRef<DestinationApproval[]>([]);
  const websiteOrigin = shallowRef('');
  const destinationWebsite = shallowRef('');
  const destinationProvider = shallowRef<TrackerSystemType>('openproject');
  const destinationUrl = shallowRef('');
  const statusKey = shallowRef('app.statusReady');
  const errorKey = shallowRef<string | null>(null);
  const websiteErrorKey = shallowRef<string | null>(null);
  const destinationErrorKey = shallowRef<string | null>(null);
  const missingOrigins = shallowRef<string[]>([]);
  const busy = shallowRef(false);
  const loaded = shallowRef(false);
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
    onScopeDispose(() => {
      unsubscribe();
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
      const state = await service.list();
      const origins = [
        ...new Set([
          ...state.websites.map((item) => item.origin),
          ...state.destinations.map((item) => item.origin),
        ]),
      ];
      const granted = await Promise.all(origins.map((origin) => service.hasHostPermission(origin)));
      if (version !== refreshVersion) return;
      const changed =
        JSON.stringify([websites.value, destinations.value]) !==
        JSON.stringify([state.websites, state.destinations]);
      websites.value = state.websites;
      destinations.value = state.destinations;
      missingOrigins.value = origins.filter((_, index) => !granted[index]);
      loaded.value = true;
      if (errorKey.value === 'approvals.loadFailed') errorKey.value = null;
      if (!state.websites.some((item) => item.origin === destinationWebsite.value)) {
        destinationWebsite.value = state.websites[0]?.origin ?? '';
      }
      if (changed && !busy.value) statusKey.value = 'app.statusReady';
      try {
        await scripts.reconcile(
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
    statusKey.value = 'app.statusReady';
    try {
      canonicalizeWebsiteOrigin(websiteOrigin.value);
    } catch {
      websiteErrorKey.value = 'approvals.invalidWebsite';
      return;
    }
    await runChange(async () => {
      await service.approveWebsite(websiteOrigin.value);
      websiteOrigin.value = '';
    }, 'approvals.saved');
  }

  async function revokeWebsite(origin: string): Promise<void> {
    await runChange(() => service.revokeWebsite(origin), 'approvals.revoked');
  }

  async function addDestination(): Promise<void> {
    if (busy.value) return;
    errorKey.value = null;
    statusKey.value = 'app.statusReady';
    try {
      canonicalizeDestination(destinationUrl.value);
    } catch {
      destinationErrorKey.value = 'approvals.invalidDestination';
      return;
    }
    if (!websites.value.some((item) => item.origin === destinationWebsite.value)) {
      errorKey.value = 'approvals.websiteRequired';
      return;
    }
    await runChange(async () => {
      await service.approveDestination(
        destinationWebsite.value,
        destinationProvider.value,
        destinationUrl.value,
      );
      destinationUrl.value = '';
    }, 'approvals.saved');
  }

  async function revokeDestination(approval: DestinationApproval): Promise<void> {
    await runChange(() => service.revokeDestination(approval), 'approvals.revoked');
  }

  async function restoreWebsite(origin: string): Promise<void> {
    await runChange(async () => {
      await service.approveWebsite(origin);
    }, 'approvals.saved');
  }

  async function restoreDestination(approval: DestinationApproval): Promise<void> {
    await runChange(async () => {
      await service.approveDestination(
        approval.websiteOrigin,
        approval.provider,
        `${approval.origin}${approval.basePath}`,
      );
    }, 'approvals.saved');
  }

  async function retry(): Promise<void> {
    await runChange(() => service.reconcile(), 'approvals.repaired');
  }

  async function runChange(action: () => Promise<void>, successKey: string): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    errorKey.value = null;
    statusKey.value = 'approvals.working';
    try {
      await action();
      statusKey.value = successKey;
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
    statusKey: readonly(statusKey),
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
  };
}

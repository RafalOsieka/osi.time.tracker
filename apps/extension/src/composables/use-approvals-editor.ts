import { computed, readonly, shallowRef } from 'vue';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type {
  ApprovalService,
  DestinationApproval,
  WebsiteApproval,
} from '../approvals/approvals.js';
import {
  CanonicalizationError,
  canonicalizeDestination,
  isHttpCredentialRisk,
} from '../security/canonicalize.js';

export interface ContentScriptPort {
  register: (origin: string) => Promise<void>;
  unregister: (origin: string) => Promise<void>;
  reconcile: (origins: readonly string[]) => Promise<void>;
}

const noopScripts: ContentScriptPort = {
  register: async () => {},
  unregister: async () => {},
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

  const httpWarning = computed(() => {
    try {
      return isHttpCredentialRisk(canonicalizeDestination(destinationUrl.value));
    } catch {
      return false;
    }
  });

  async function refresh(): Promise<void> {
    const state = await service.list();
    websites.value = state.websites;
    destinations.value = state.destinations;
    await scripts.reconcile(state.websites.map((item) => item.origin));
    if (!destinationWebsite.value && state.websites[0]) {
      destinationWebsite.value = state.websites[0].origin;
    }
  }

  async function addWebsite(): Promise<void> {
    errorKey.value = null;
    try {
      const approval = await service.approveWebsite(websiteOrigin.value);
      await scripts.register(approval.origin);
      websiteOrigin.value = '';
      statusKey.value = 'approvals.saved';
      await refresh();
    } catch (error) {
      applyError(error);
    }
  }

  async function revokeWebsite(origin: string): Promise<void> {
    errorKey.value = null;
    await service.revokeWebsite(origin);
    await scripts.unregister(origin);
    statusKey.value = 'approvals.revoked';
    await refresh();
  }

  async function addDestination(): Promise<void> {
    errorKey.value = null;
    try {
      await service.approveDestination(
        destinationWebsite.value,
        destinationProvider.value,
        destinationUrl.value,
      );
      destinationUrl.value = '';
      statusKey.value = 'approvals.saved';
      await refresh();
    } catch (error) {
      applyError(error);
    }
  }

  async function revokeDestination(approval: DestinationApproval): Promise<void> {
    errorKey.value = null;
    await service.revokeDestination(approval);
    statusKey.value = 'approvals.revoked';
    await refresh();
  }

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
  function applyError(error: unknown): void {
    if (error instanceof CanonicalizationError) {
      errorKey.value =
        error.messageKey === 'error.extensionPermissionRequired'
          ? 'approvals.denied'
          : error.messageKey;
      return;
    }
    errorKey.value = 'error.extensionMalformed';
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
    httpWarning,
    refresh,
    addWebsite,
    revokeWebsite,
    addDestination,
    revokeDestination,
  };
}

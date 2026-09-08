import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import {
  CanonicalizationError,
  canonicalizeDestination,
  canonicalizeWebsiteOrigin,
  isPathWithinBase,
  type CanonicalOrigin,
} from '../security/canonicalize.js';

export interface WebsiteApproval {
  origin: string;
}

export interface DestinationApproval {
  websiteOrigin: string;
  provider: TrackerSystemType;
  origin: string;
  basePath: string;
}

export interface ApprovalState {
  websites: WebsiteApproval[];
  destinations: DestinationApproval[];
}

export interface ApprovalStore {
  load: () => Promise<ApprovalState>;
  save: (state: ApprovalState) => Promise<void>;
  subscribe?: (listener: (state: ApprovalState) => void) => () => void;
}

export interface HostPermissionPort {
  contains: (matchPattern: string) => Promise<boolean>;
  request: (matchPattern: string) => Promise<boolean>;
  remove: (matchPattern: string) => Promise<void>;
  list: () => Promise<string[]>;
}

export interface OperationAbortHandle {
  abort: () => void;
}

const emptyState: ApprovalState = { websites: [], destinations: [] };

export function createMemoryApprovalStore(initial: ApprovalState = emptyState): ApprovalStore {
  const listeners = new Set<(state: ApprovalState) => void>();
  let state: ApprovalState = {
    websites: [...initial.websites],
    destinations: [...initial.destinations],
  };
  return {
    load: async () => ({
      websites: [...state.websites],
      destinations: [...state.destinations],
    }),
    save: async (next) => {
      state = {
        websites: [...next.websites],
        destinations: [...next.destinations],
      };
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createMemoryHostPermissions(
  granted: Set<string> = new Set(),
): HostPermissionPort & { granted: Set<string> } {
  return {
    granted,
    contains: async (matchPattern) => granted.has(matchPattern),
    request: async (matchPattern) => {
      granted.add(matchPattern);
      return true;
    },
    remove: async (matchPattern) => {
      granted.delete(matchPattern);
    },
    list: async () => [...granted],
  };
}

export function hostMatchPattern(origin: string): string {
  return `${origin}/*`;
}

function sameDestination(left: DestinationApproval, right: DestinationApproval): boolean {
  return (
    left.websiteOrigin === right.websiteOrigin &&
    left.provider === right.provider &&
    left.origin === right.origin &&
    left.basePath === right.basePath
  );
}

function neededPatterns(state: ApprovalState): Set<string> {
  const needed = new Set<string>();
  for (const website of state.websites) {
    needed.add(hostMatchPattern(website.origin));
  }
  for (const destination of state.destinations) {
    needed.add(hostMatchPattern(destination.origin));
  }
  return needed;
}

export class ApprovalService {
  private inFlightAborts = new Map<OperationAbortHandle, DestinationApproval>();
  private unsubscribe?: () => void;

  constructor(
    private readonly store: ApprovalStore,
    private readonly permissions: HostPermissionPort,
  ) {}

  async list(): Promise<ApprovalState> {
    return this.store.load();
  }

  async approveWebsite(rawOrigin: string): Promise<WebsiteApproval> {
    const canonical = canonicalizeWebsiteOrigin(rawOrigin);
    const granted = await this.permissions.request(hostMatchPattern(canonical.origin));
    if (!granted) {
      throw new CanonicalizationError('error.extensionPermissionRequired');
    }
    const state = await this.store.load();
    if (!state.websites.some((item) => item.origin === canonical.origin)) {
      state.websites.push({ origin: canonical.origin });
      await this.store.save(state);
    }
    return { origin: canonical.origin };
  }

  async approveDestination(
    websiteOriginRaw: string,
    provider: TrackerSystemType,
    destinationRaw: string,
  ): Promise<DestinationApproval> {
    const website = canonicalizeWebsiteOrigin(websiteOriginRaw);
    const destination = canonicalizeDestination(destinationRaw);
    const state = await this.store.load();
    if (!state.websites.some((item) => item.origin === website.origin)) {
      throw new CanonicalizationError('error.extensionOriginUnapproved');
    }
    const granted = await this.permissions.request(hostMatchPattern(destination.origin));
    if (!granted) {
      throw new CanonicalizationError('error.extensionPermissionRequired');
    }
    const approval: DestinationApproval = {
      websiteOrigin: website.origin,
      provider,
      origin: destination.origin,
      basePath: destination.pathname,
    };
    if (!state.destinations.some((item) => sameDestination(item, approval))) {
      state.destinations.push(approval);
      await this.store.save(state);
    }
    return approval;
  }

  async revokeWebsite(origin: string): Promise<void> {
    const state = await this.store.load();
    const next: ApprovalState = {
      websites: state.websites.filter((item) => item.origin !== origin),
      destinations: state.destinations.filter((item) => item.websiteOrigin !== origin),
    };
    await this.store.save(next);
    this.abortUnapproved(next);
    await this.reconcilePermissions(next);
  }

  async revokeDestination(approval: DestinationApproval): Promise<void> {
    const state = await this.store.load();
    const next: ApprovalState = {
      websites: state.websites,
      destinations: state.destinations.filter((item) => !sameDestination(item, approval)),
    };
    await this.store.save(next);
    this.abortUnapproved(next);
    await this.reconcilePermissions(next);
  }

  registerInFlight(approval: DestinationApproval, handle: OperationAbortHandle): () => void {
    if (this.inFlightAborts.size === 0) {
      this.unsubscribe = this.store.subscribe?.((state) => this.abortUnapproved(state));
    }
    this.inFlightAborts.set(handle, approval);
    return () => {
      this.inFlightAborts.delete(handle);
      if (this.inFlightAborts.size === 0) {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
      }
    };
  }

  async authorizedDestination(
    websiteOrigin: string,
    provider: TrackerSystemType,
    destinationRaw: string,
  ): Promise<DestinationApproval> {
    const website = canonicalizeWebsiteOrigin(websiteOrigin);
    const destination = canonicalizeDestination(destinationRaw);
    const state = await this.store.load();
    if (!state.websites.some((item) => item.origin === website.origin)) {
      throw new CanonicalizationError('error.extensionOriginUnapproved');
    }
    const match = state.destinations.find(
      (item) =>
        item.websiteOrigin === website.origin &&
        item.provider === provider &&
        item.origin === destination.origin &&
        item.basePath === destination.pathname,
    );
    if (!match) {
      throw new CanonicalizationError('error.extensionDestinationUnapproved');
    }
    const [hostGranted, websiteGranted] = await Promise.all([
      this.permissions.contains(hostMatchPattern(match.origin)),
      this.permissions.contains(hostMatchPattern(website.origin)),
    ]);
    if (!hostGranted || !websiteGranted) {
      throw new CanonicalizationError('error.extensionPermissionRequired');
    }
    return match;
  }

  async reconcilePermissions(state?: ApprovalState): Promise<void> {
    const current = state ?? (await this.store.load());
    const needed = neededPatterns(current);
    const granted = await this.permissions.list();
    for (const pattern of granted) {
      if (needed.has(pattern)) continue;
      await this.permissions.remove(pattern);
    }
  }

  private abortUnapproved(state: ApprovalState): void {
    for (const [handle, approval] of this.inFlightAborts) {
      if (
        state.websites.some((item) => item.origin === approval.websiteOrigin) &&
        state.destinations.some((item) => sameDestination(item, approval))
      )
        continue;
      this.inFlightAborts.delete(handle);
      handle.abort();
    }
    if (this.inFlightAborts.size === 0) {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }
  }
}

export function destinationAllowsUrl(
  approval: DestinationApproval,
  requestUrl: CanonicalOrigin,
): boolean {
  return (
    requestUrl.origin === approval.origin &&
    isPathWithinBase(requestUrl.pathname, approval.basePath)
  );
}

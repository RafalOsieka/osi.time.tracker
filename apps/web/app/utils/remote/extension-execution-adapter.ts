import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  ExtensionProtocolError,
  type DestinationSelector,
  type ExtensionOperationName,
  type OperationRequest,
} from '@osi/extension-protocol';
import {
  RemoteAdapterError,
  type RemoteAccount,
  type RemoteFieldOption,
  type RemoteIssueSearchResult,
  type RemoteTimeLogDto,
  type RemoteTrackerAdapter,
  type TrackerSystemType,
} from '@osi/remote-trackers/contracts';
import type { ExtensionBridgeOptions, ExtensionDocumentBridge } from './extension-bridge';
import { openExtensionBridge } from './extension-availability';

export interface ExtensionExecutionAdapterOptions {
  isClient?: boolean;
  openBridge?: (options?: Partial<ExtensionBridgeOptions>) => ExtensionDocumentBridge;
  bridgeOptions?: Partial<ExtensionBridgeOptions>;
}

function unavailableError(): ExtensionProtocolError {
  return new ExtensionProtocolError('unavailable', EXTENSION_ERROR_MESSAGE_KEYS.unavailable);
}

function permissionError(messageKey = EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved) {
  return new ExtensionProtocolError('permission', messageKey);
}

/**
 * `extension` execution-mode adapter: handshakes without a secret, then
 * forwards the seven contract operations through the document bridge.
 */
export class ExtensionExecutionAdapter implements RemoteTrackerAdapter {
  private bridge: ExtensionDocumentBridge | undefined;
  private ready: Promise<void> | undefined;

  constructor(
    private readonly config: { systemType: TrackerSystemType; baseUrl: string },
    private readonly secret: string | null,
    private readonly options: ExtensionExecutionAdapterOptions = {},
  ) {}

  async searchIssues(query: string): Promise<RemoteIssueSearchResult[]> {
    return this.invoke('searchIssues', query);
  }

  async getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    return this.invoke('getIssueById', remoteIssueId);
  }

  async getActivityOptions(remoteIssueId: string): Promise<RemoteFieldOption[]> {
    return this.invoke('getActivityOptions', remoteIssueId);
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    return this.invoke('getCurrentAccount', null);
  }

  async fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    return this.invoke('fetchTimeLogs', input);
  }

  async fetchTimeLogsInRange(input: {
    from: string;
    to: string;
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    return this.invoke('fetchTimeLogsInRange', input);
  }

  async createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    return this.invoke('createTimeEntry', input);
  }

  private destination(): DestinationSelector {
    return { provider: this.config.systemType, baseUrl: this.config.baseUrl };
  }

  private async ensureReady(): Promise<ExtensionDocumentBridge> {
    const isClient = this.options.isClient ?? import.meta.client;
    if (!isClient) throw unavailableError();

    if (!this.ready) {
      this.ready = this.connect().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    }
    await this.ready;
    if (!this.bridge) throw unavailableError();
    if (!this.secret) {
      throw new RemoteAdapterError('error.remoteServerModeSecretRequired');
    }
    return this.bridge;
  }

  private async connect(): Promise<void> {
    const bridge = (this.options.openBridge ?? openExtensionBridge)(this.options.bridgeOptions);
    this.bridge = bridge;
    try {
      const handshake = await bridge.handshake(this.destination());
      if (handshake.destinationApproved === false) {
        throw permissionError();
      }
    } catch (error) {
      bridge.close();
      this.bridge = undefined;
      throw error;
    }
  }

  private async invoke<T>(
    operation: ExtensionOperationName,
    payload: OperationRequest['input'],
  ): Promise<T> {
    const bridge = await this.ensureReady();
    // SAFETY: `secret` is checked in ensureReady before any operation is posted.
    const secret = this.secret as string;
    const result = await bridge.request({
      operation,
      provider: this.config.systemType,
      baseUrl: this.config.baseUrl,
      secret,
      payload,
    });
    // SAFETY: protocol result schema for `operation` matches T at each call site.
    return result as T;
  }
}

interface ChromeRuntimeSender {
  id?: string;
  origin?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
  documentId?: string;
}

interface ChromeRuntimePort {
  name: string;
  sender?: ChromeRuntimeSender;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

interface ChromeStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromePermissions {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
  remove(permissions: { origins: string[] }): Promise<boolean>;
  getAll(): Promise<{ origins?: string[] }>;
}

interface ChromeRegisteredContentScript {
  id: string;
}

interface ChromeScripting {
  registerContentScripts(
    scripts: Array<{
      id: string;
      matches: string[];
      js: string[];
      runAt: 'document_start';
      world: 'ISOLATED';
      persistAcrossSessions: boolean;
    }>,
  ): Promise<void>;
  unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
  getRegisteredContentScripts(): Promise<ChromeRegisteredContentScript[]>;
}

declare const chrome: {
  runtime: {
    id: string;
    connect(connectInfo: { name: string }): ChromeRuntimePort;
    openOptionsPage(): void;
    onConnect: { addListener(callback: (port: ChromeRuntimePort) => void): void };
  };
  storage: { local: ChromeStorageArea };
  permissions: ChromePermissions;
  scripting: ChromeScripting;
};

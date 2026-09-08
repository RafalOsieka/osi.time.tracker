interface ChromeRuntimeSender {
  id?: string;
  origin?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
  documentId?: string;
}

type ChromeJson =
  | string
  | number
  | boolean
  | null
  | ChromeJson[]
  | { readonly [key: string]: ChromeJson };

interface ChromeRuntimePort {
  name: string;
  sender?: ChromeRuntimeSender;
  postMessage(message: ChromeJson): void;
  disconnect(): void;
  onMessage: { addListener(callback: (message: ChromeJson) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

interface ChromeStorageArea {
  get(keys: string): Promise<{ readonly [key: string]: ChromeJson | undefined }>;
  set(items: { readonly [key: string]: ChromeJson }): Promise<void>;
}

interface ChromeStorageChanges {
  addListener(
    callback: (
      changes: { readonly [key: string]: { newValue?: ChromeJson } },
      area: string,
    ) => void,
  ): void;
  removeListener(
    callback: (
      changes: { readonly [key: string]: { newValue?: ChromeJson } },
      area: string,
    ) => void,
  ): void;
}

interface ChromePermissionChanges {
  addListener(
    callback: (permissions: { origins?: string[]; permissions?: string[] }) => void,
  ): void;
  removeListener(
    callback: (permissions: { origins?: string[]; permissions?: string[] }) => void,
  ): void;
}

interface ChromePermissions {
  onAdded: ChromePermissionChanges;
  onRemoved: ChromePermissionChanges;
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
  storage: { local: ChromeStorageArea; onChanged: ChromeStorageChanges };
  permissions: ChromePermissions;
  scripting: ChromeScripting;
};

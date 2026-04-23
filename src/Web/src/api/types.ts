export type RemoteTarget = 1 | 2; // 1 = Redmine, 2 = OpenProject

export interface Project {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
}

export interface Item {
  id: string;
  projectId: string;
  name: string;
  remoteTarget: RemoteTarget;
  remoteBaseUrl: string;
  remoteId: string;
  isArchived: boolean;
  project?: Project | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  itemId: string;
  title: string;
  note: string | null;
  startUtc: string;
  endUtc: string | null;
  item?: Item | null;
  project?: Project | null;
  published: boolean;
  publishedAtUtc: string | null;
  publishedTo: RemoteTarget | null;
  publishedRemoteId: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface StartTimerRequest {
  itemId: string;
  title: string;
  note?: string | null;
}

export interface CreateEntryRequest {
  itemId: string;
  title: string;
  note?: string | null;
  startUtc: string;
  endUtc?: string | null;
}

export interface UpdateEntryRequest {
  title: string;
  note?: string | null;
  startUtc: string;
  endUtc?: string | null;
}

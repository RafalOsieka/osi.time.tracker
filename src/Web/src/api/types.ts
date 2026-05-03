export type RemoteTarget = 1 | 2; // 1 = Redmine, 2 = OpenProject

export interface Project {
  id: string;
  name: string;
  color: string | null;
  isDefault: boolean;
  remoteTarget: RemoteTarget | null;
  remoteBaseUrl: string | null;
  isRemote: boolean;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
}

export interface Item {
  id: string;
  projectId: string;
  title: string;
  remoteId: string | null;
  isArchived: boolean;
  project?: Project | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface TimeEntry {
  id: string;
  itemId: string;
  title: string;
  startUtc: string;
  endUtc: string | null;
  item?: Item | null;
  published: boolean;
  publishedAtUtc: string | null;
  publishedTo: RemoteTarget | null;
  publishedRemoteId: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface StartTimerRequest {
  itemId: string | null;
  title: string;
}

export interface CreateEntryRequest {
  itemId: string;
  title: string;
  startUtc: string;
  endUtc?: string | null;
}

export interface UpdateEntryRequest {
  title: string;
  startUtc: string;
  endUtc?: string | null;
}

export interface CreateProjectRequest {
  name: string;
  color?: string | null;
  isDefault?: boolean;
  remoteTarget?: RemoteTarget | null;
  remoteBaseUrl?: string | null;
}

export interface UpdateProjectRequest {
  name: string;
  color?: string | null;
  isArchived: boolean;
  isDefault: boolean;
  remoteTarget?: RemoteTarget | null;
  remoteBaseUrl?: string | null;
}

export interface CreateItemRequest {
  projectId: string;
  title: string;
  remoteId?: string | null;
}

export interface UpdateItemRequest {
  title: string;
  isArchived: boolean;
}

export interface MatchItemRequest {
  remoteId: string;
  remoteTitle: string;
}

export interface MergeItemsRequest {
  sourceId: string;
  targetId: string;
}

export interface DailyReportDto {
  date: string;
  totalSeconds: number;
}

export interface ItemReportDto {
  itemId: string;
  itemTitle: string;
  projectName: string;
  totalSeconds: number;
}

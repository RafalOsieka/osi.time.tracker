import ky from 'ky';

import type {
  CreateEntryRequest,
  DailyReportDto,
  Item,
  ItemReportDto,
  Project,
  StartTimerRequest,
  TimeEntry,
  UpdateEntryRequest,
} from './types';

const API = '/api';

export const timerApi = {
  getActive: () => ky.get(`${API}/timer/active`).json<TimeEntry | null>(),
  start: (body: StartTimerRequest) => ky.post(`${API}/timer/start`, { json: body }).json<TimeEntry>(),
  stop: () => ky.post(`${API}/timer/stop`).json<TimeEntry>(),
};

export const entriesApi = {
  list: (from: string, to: string, itemId?: string) => {
    const searchParams: Record<string, string> = { from, to };
    if (itemId) searchParams.itemId = itemId;
    return ky.get(`${API}/entries`, { searchParams }).json<TimeEntry[]>();
  },
  create: (body: CreateEntryRequest) => ky.post(`${API}/entries`, { json: body }).json<TimeEntry>(),
  update: (id: string, body: UpdateEntryRequest) => ky.put(`${API}/entries/${id}`, { json: body }).json<TimeEntry>(),
  remove: (id: string) => ky.delete(`${API}/entries/${id}`).json<void>(),
};

export const itemsApi = {
  list: () => ky.get(`${API}/items`).json<Item[]>(),
  create: (body: {
    projectId: string;
    name: string;
    remoteTarget: number;
    remoteBaseUrl: string;
    remoteId: string;
  }) => ky.post(`${API}/items`, { json: body }).json<Item>(),
  update: (id: string, body: { name: string; isArchived: boolean }) =>
    ky.put(`${API}/items/${id}`, { json: body }).json<Item>(),
  remove: (id: string) => ky.delete(`${API}/items/${id}`).json<void>(),
};

export const projectsApi = {
  list: () => ky.get(`${API}/projects`).json<Project[]>(),
  create: (body: { name: string; color?: string | null }) => ky.post(`${API}/projects`, { json: body }).json<Project>(),
  update: (id: string, body: { name: string; color?: string | null; isArchived: boolean }) =>
    ky.put(`${API}/projects/${id}`, { json: body }).json<Project>(),
  remove: (id: string) => ky.delete(`${API}/projects/${id}`).json<void>(),
};

export const reportsApi = {
  getDaily: (from: string, to: string) =>
    ky.get(`${API}/reports/daily`, { searchParams: { from, to } }).json<DailyReportDto[]>(),
  getItem: (from: string, to: string) =>
    ky.get(`${API}/reports/by-item`, { searchParams: { from, to } }).json<ItemReportDto[]>(),
};

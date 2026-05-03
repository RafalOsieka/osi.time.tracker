// Per-project token storage in browser localStorage.
// Storage key pattern: osi_token_{projectId}
const PREFIX = 'osi_token_';

export function getProjectToken(projectId: string): string {
  try {
    return localStorage.getItem(PREFIX + projectId) ?? '';
  } catch {
    return '';
  }
}

export function setProjectToken(projectId: string, token: string): void {
  try {
    if (token) localStorage.setItem(PREFIX + projectId, token);
    else localStorage.removeItem(PREFIX + projectId);
  } catch {
    // ignore quota / privacy mode
  }
}

export function clearProjectToken(projectId: string): void {
  try {
    localStorage.removeItem(PREFIX + projectId);
  } catch {
    // ignore
  }
}

export function hasProjectToken(projectId: string): boolean {
  return getProjectToken(projectId).length > 0;
}

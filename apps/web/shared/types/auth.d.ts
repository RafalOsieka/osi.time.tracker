declare module '#auth-utils' {
  import type { UserSettingsDto } from './user-settings';

  interface User {
    id: string;
    email: string;
    displayName?: string | null;
    settings?: UserSettingsDto;
  }
}

export {};

declare module '#auth-utils' {
  import type { ProfileDto } from './profile';

  /** Session user (core-authentication REQ-007); mirrors `AuthUser` in `./auth.ts`. */
  interface User {
    id: string;
    email: string;
    displayName: ProfileDto['displayName'];
    timezone: ProfileDto['timezone'];
  }
}

export {};

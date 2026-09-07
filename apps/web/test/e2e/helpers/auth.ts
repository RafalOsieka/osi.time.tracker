import { url } from './url';
import { E2E_LOGIN_RATE_LIMIT } from '../../../shared/config/rate-limit';

/**
 * Minimal cookie jar for e2e auth tests.
 *
 * The running Nuxt server issues several cookies (the nuxt-csurf secret and the
 * nuxt-auth-utils session). We track them by name and replay them on follow-up
 * requests, mimicking a browser.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** Absorb every `set-cookie` header from a response. */
  capture(response: Response): void {
    // `getSetCookie` returns each Set-Cookie header separately (Node 18.14+).
    const raw = response.headers.getSetCookie();
    for (const entry of raw) {
      const [pair] = entry.split(';');
      const eq = pair!.indexOf('=');
      if (eq === -1) continue;
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      if (value === '' || value.toLowerCase() === 'deleted') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  /** Serialize the jar into a `Cookie` request header. */
  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

/**
 * Fetch the home page to obtain a usable CSRF token (rendered into a
 * `<meta name="csrf-token">` tag) and its matching secret cookie.
 */
export async function primeCsrf(jar: CookieJar): Promise<string> {
  const res = await fetch(url('/'), { headers: { cookie: jar.header() } });
  jar.capture(res);
  const html = await res.text();
  if (!res.ok) {
    throw new Error(`CSRF prime GET / failed: HTTP ${res.status}`);
  }
  const match = html.match(/<meta name="csrf-token" content="([^"]+)">/);
  if (!match) {
    throw new Error('CSRF token meta tag not found in rendered HTML');
  }
  return match[1]!;
}

export type ApiSession = { jar: CookieJar; token: string };

/**
 * Log in over HTTP and return a primed CookieJar + CSRF token.
 */
export async function apiLogin(email: string, password = 'secret'): Promise<ApiSession> {
  const jar = new CookieJar();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await primeCsrf(jar);
    const res = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({ email, password }),
    });
    jar.capture(res);
    lastStatus = res.status;
    if (res.status === 200) {
      return { jar, token };
    }
    if (res.status !== 429) {
      throw new Error(`apiLogin failed for ${email}: HTTP ${res.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, E2E_LOGIN_RATE_LIMIT.interval));
  }
  throw new Error(`apiLogin failed for ${email}: HTTP ${lastStatus}`);
}

import { url } from '@nuxt/test-utils/e2e';

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
    const raw =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie') as string]
          : [];
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
  const match = html.match(/<meta name="csrf-token" content="([^"]+)">/);
  if (!match) {
    throw new Error('CSRF token meta tag not found in rendered HTML');
  }
  return match[1]!;
}

export class CanonicalizationError extends Error {
  readonly messageKey: string;

  constructor(messageKey: string) {
    super(messageKey);
    this.name = 'CanonicalizationError';
    this.messageKey = messageKey;
  }
}

export interface CanonicalOrigin {
  href: string;
  origin: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: string;
  pathname: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function rejectEncodedSeparators(pathname: string): void {
  if (/%2f|%5c/i.test(pathname)) {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
}

function normalizePathname(pathname: string): string {
  rejectEncodedSeparators(pathname);
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('\\')) {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  const segments = decoded.split('/');
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      throw new CanonicalizationError('error.extensionDestinationUnapproved');
    }
    normalized.push(segment);
  }
  return normalized.length === 0 ? '' : `/${normalized.join('/')}`;
}

function rejectRawTraversal(raw: string): void {
  const pathAndRest = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*/, '');
  const pathname = pathAndRest.split(/[?#]/, 1)[0] ?? '';
  if (/(^|\/)\.\.?(\/|$)/.test(pathname) || /%2e/i.test(pathname)) {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
}

function parseHttpUrl(raw: string): URL {
  rejectRawTraversal(raw);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CanonicalizationError('error.extensionMalformed');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  return parsed;
}

/** Request URLs may include a query string; fragments and credentials still fail. */
export function canonicalizeRequestUrl(raw: string): CanonicalOrigin {
  rejectRawTraversal(raw);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CanonicalizationError('error.extensionMalformed');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  if (parsed.hash !== '') {
    throw new CanonicalizationError('error.extensionDestinationUnapproved');
  }
  return toCanonical(parsed);
}

function toCanonical(parsed: URL): CanonicalOrigin {
  const pathname = normalizePathname(parsed.pathname);
  const protocol = parsed.protocol === 'http:' ? 'http:' : 'https:';
  return {
    href: `${parsed.origin}${pathname}`,
    origin: parsed.origin,
    protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname,
  };
}

/** Exact website origin used for OSI page approvals. */
export function canonicalizeWebsiteOrigin(raw: string): CanonicalOrigin {
  const parsed = parseHttpUrl(raw);
  const canonical = toCanonical(parsed);
  if (canonical.pathname !== '') {
    throw new CanonicalizationError('error.extensionOriginUnapproved');
  }
  if (canonical.protocol === 'http:' && !isLoopbackHost(canonical.hostname)) {
    throw new CanonicalizationError('error.extensionOriginUnapproved');
  }
  return canonical;
}

/** Tracker destination origin plus normalized base path. */
export function canonicalizeDestination(raw: string): CanonicalOrigin {
  return toCanonical(parseHttpUrl(raw));
}

export function isHttpCredentialRisk(canonical: CanonicalOrigin): boolean {
  return canonical.protocol === 'http:';
}

export function isPathWithinBase(requestPath: string, basePath: string): boolean {
  if (basePath === '') return true;
  return requestPath === basePath || requestPath.startsWith(`${basePath}/`);
}

export function originsMatch(left: CanonicalOrigin, right: CanonicalOrigin): boolean {
  return left.origin === right.origin;
}

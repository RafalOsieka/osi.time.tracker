import type { ZodError } from 'zod';

export function mapZodError(error: ZodError): {
  messageKey: string;
  params?: Record<string, unknown>;
} {
  const issue = error.issues[0];
  if (!issue) {
    return { messageKey: 'errors.unexpected' };
  }

  // A message key starts with alphanumeric characters and has at least one dot, with no spaces
  const isMessageKey = /^[a-z0-9]+(?:\.[a-z0-9_]+)+$/i.test(issue.message);
  if (!isMessageKey) {
    return { messageKey: 'errors.unexpected' };
  }

  const messageKey = issue.message;
  const params: Record<string, unknown> = {};

  if ('minimum' in issue && issue.minimum !== undefined && issue.minimum !== null) {
    params.min = issue.minimum;
  }
  if ('maximum' in issue && issue.maximum !== undefined && issue.maximum !== null) {
    params.max = issue.maximum;
  }
  if ('expected' in issue) {
    params.expected = issue.expected;
  }
  if ('received' in issue) {
    params.received = issue.received;
  }

  // Merge custom parameters if present
  if ('params' in issue && typeof issue.params === 'object' && issue.params !== null) {
    Object.assign(params, issue.params);
  }

  if (Object.keys(params).length > 0) {
    return { messageKey, params };
  }

  return { messageKey };
}

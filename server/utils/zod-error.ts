import type { ZodError } from 'zod';
import type { ApiMessage } from '../types/api-message';
import type { MessageParams } from '../../shared/types/message-params';

export function mapZodError(error: ZodError): ApiMessage {
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
  const params: MessageParams = {};

  if ('minimum' in issue && issue.minimum != null) {
    params.min = Number(issue.minimum);
  }
  if ('maximum' in issue && issue.maximum != null) {
    params.max = Number(issue.maximum);
  }
  if ('expected' in issue && issue.expected !== undefined) {
    params.expected = String(issue.expected);
  }

  if ('params' in issue && issue.params) {
    // SAFETY: custom zod issue.params are primitive interpolation values on this contract.
    Object.assign(params, issue.params as MessageParams);
  }

  if (Object.keys(params).length > 0) {
    return { messageKey, params };
  }

  return { messageKey };
}

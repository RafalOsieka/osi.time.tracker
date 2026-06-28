export const CLIENT_NAME_MAX_LENGTH = 100;

export interface ValidationResult {
  valid: boolean;
  messageKey?: string;
}

export function validateClientName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, messageKey: 'error.clientNameRequired' };
  }
  if (name.trim().length > CLIENT_NAME_MAX_LENGTH) {
    return { valid: false, messageKey: 'error.clientNameTooLong' };
  }
  return { valid: true };
}

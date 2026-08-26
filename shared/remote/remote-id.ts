/** OpenProject and Redmine identify resources with a string or number. */
export function coerceRemoteId(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  return String(value);
}

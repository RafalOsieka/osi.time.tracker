/**
 * Postgres unique_violation (`23505`) on a driver Error, or on the driver
 * error drizzle wraps as `cause` (`DrizzleQueryError`).
 */
export function isUniqueViolation(err: Error): boolean {
  if ('code' in err && err.code === '23505') return true;
  return err.cause instanceof Error && isUniqueViolation(err.cause);
}

/** Postgres unique_violation (`23505`) on a driver Error. */
export function isUniqueViolation(err: Error): boolean {
  return 'code' in err && err.code === '23505';
}

/**
 * Deterministic "valid but unknown" UUIDv7 used by e2e negative cases that
 * expect HTTP 404 (well-formed id that does not exist). RFC version nibble
 * is `7` and the variant nibble is RFC 4122 (`8`/`9`/`a`/`b`).
 */
export const UNKNOWN_ID = '01900000-0000-7000-8000-000000000001';

/**
 * Deliberately malformed identifier for cases that assert HTTP 422 from
 * boundary validation before any data access. Zod 4's `z.uuid()` accepts the
 * RFC nil/max sentinels, so this uses an all-zero prefix with a non-zero tail
 * (invalid version nibble) instead of the nil UUID.
 */
export const MALFORMED_ID = '00000000-0000-0000-0000-000000000001';

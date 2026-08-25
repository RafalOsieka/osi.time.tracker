/**
 * Nuxt UI table expand model: `true` means expand-all; otherwise a per-row map.
 */
export type TableExpandMap = true | Record<string, boolean>;

/** Normalize expand-all sentinel to a plain map copy (empty when expand-all). */
export function asExpandMap(value: TableExpandMap): Record<string, boolean> {
  return value === true ? {} : { ...value };
}

export function isExpandedInMap(value: TableExpandMap, key: string): boolean {
  if (value === true) return true;
  return !!value[key];
}

/**
 * Toggle one key. When the model is expand-all (`true`), collapsing a row
 * yields a map with that key set to false (other rows stay expanded only if
 * the consumer re-expands them individually — matches prior page behavior).
 */
export function toggleExpandMap(value: TableExpandMap, key: string) {
  if (value === true) {
    return { [key]: false };
  }
  const current = asExpandMap(value);
  current[key] = !current[key];
  return current;
}

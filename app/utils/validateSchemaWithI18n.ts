import type { FormError } from '@nuxt/ui';

/** Minimal Standard Schema shape used by Nuxt UI form validation. */
export type StandardSchemaLike = {
  '~standard': {
    validate: (
      value: unknown,
    ) =>
      | { issues?: ReadonlyArray<{ message: string; path?: readonly unknown[] }> }
      | Promise<{ issues?: ReadonlyArray<{ message: string; path?: readonly unknown[] }> }>;
  };
};

function pathToName(path: readonly unknown[] | undefined): string {
  if (!path?.length) return '';
  return path
    .map((item) =>
      typeof item === 'object' && item !== null && 'key' in item
        ? String((item as { key: unknown }).key)
        : String(item),
    )
    .join('.');
}

/**
 * Run a Standard Schema (e.g. Zod 4) and return Nuxt UI form errors with
 * messages already translated via `t`. Use as UForm `:validate` instead of
 * `:schema` so FormField never renders raw message keys.
 */
export async function validateSchemaWithI18n(
  state: unknown,
  schema: StandardSchemaLike,
  t: (key: string) => string,
): Promise<FormError[]> {
  const result = await schema['~standard'].validate(state);
  if (!result.issues?.length) return [];
  return result.issues.map((issue) => ({
    name: pathToName(issue.path),
    message: t(issue.message),
  }));
}

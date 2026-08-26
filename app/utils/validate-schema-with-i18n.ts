import type { FormError } from '@nuxt/ui';

export type StandardSchemaPathItem =
  | string
  | number
  | symbol
  | { readonly key?: string | number | symbol };

export type StandardSchemaIssue = {
  message: string;
  path?: readonly StandardSchemaPathItem[];
};

export type StandardSchemaResult = {
  issues?: ReadonlyArray<StandardSchemaIssue>;
};

/** Minimal Standard Schema shape used by Nuxt UI form validation. */
export type StandardSchemaLike<TState> = {
  '~standard': {
    validate: (value: TState) => StandardSchemaResult | Promise<StandardSchemaResult>;
  };
};

function pathToName(path: readonly StandardSchemaPathItem[] | undefined): string {
  if (!path?.length) return '';
  return path
    .map((item) => (item instanceof Object && 'key' in item ? String(item.key) : String(item)))
    .join('.');
}

/**
 * Run a Standard Schema (e.g. Zod 4) and return Nuxt UI form errors with
 * messages already translated via `t`. Use as UForm `:validate` instead of
 * `:schema` so FormField never renders raw message keys.
 */
export async function validateSchemaWithI18n<TState>(
  state: TState,
  schema: StandardSchemaLike<TState>,
  t: (key: string) => string,
): Promise<FormError[]> {
  const result = await schema['~standard'].validate(state);
  if (!result.issues?.length) return [];
  return result.issues.map((issue) => ({
    name: pathToName(issue.path),
    message: t(issue.message),
  }));
}

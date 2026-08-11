import { describe, expect, it } from 'vitest';
import { createProjectSchema } from '../../shared/types/project';
import { validateSchemaWithI18n } from '../../app/utils/validateSchemaWithI18n';

describe('validateSchemaWithI18n', () => {
  it('returns translated form errors for invalid project state', async () => {
    const errors = await validateSchemaWithI18n(
      { name: '', trackerId: undefined },
      createProjectSchema,
      (key) => (key === 'error.projectNameRequired' ? 'Name is required.' : key),
    );

    expect(errors).toEqual([
      {
        name: 'name',
        message: 'Name is required.',
      },
    ]);
  });

  it('returns no errors for a valid project state', async () => {
    const errors = await validateSchemaWithI18n(
      { name: 'Acme', trackerId: null },
      createProjectSchema,
      (key) => key,
    );
    expect(errors).toEqual([]);
  });
});

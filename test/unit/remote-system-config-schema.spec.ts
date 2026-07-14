import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createRemoteSystemConfigSchema } from '../../shared/types/remote-system-config';
import { mapZodError } from '../../server/utils/zod-error';

describe('createRemoteSystemConfigSchema', () => {
  const valid = {
    systemType: 'redmine',
    baseUrl: 'https://redmine.example.com',
    executionMode: 'client',
    roundingRule: 'none',
  };

  it('parses a valid body', () => {
    const result = createRemoteSystemConfigSchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it('accepts optional requiredFieldDefaults', () => {
    const result = createRemoteSystemConfigSchema.parse({
      ...valid,
      requiredFieldDefaults: { activity_id: '5' },
    });
    expect(result.requiredFieldDefaults).toEqual({ activity_id: '5' });
  });

  it('rejects a missing baseUrl', () => {
    const { baseUrl, ...rest } = valid;
    expect(() => createRemoteSystemConfigSchema.parse(rest)).toThrow();
  });

  it('rejects an invalid baseUrl', () => {
    expect(() =>
      createRemoteSystemConfigSchema.parse({ ...valid, baseUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects an unknown systemType', () => {
    expect(() => createRemoteSystemConfigSchema.parse({ ...valid, systemType: 'jira' })).toThrow();
  });

  it('strips a secret field submitted alongside a valid body', () => {
    const result = createRemoteSystemConfigSchema.parse({
      ...valid,
      apiKey: 'super-secret',
      secret: 'super-secret',
    });
    expect((result as Record<string, unknown>).apiKey).toBeUndefined();
    expect((result as Record<string, unknown>).secret).toBeUndefined();
  });

  it('maps validation failures to { messageKey, params } via mapZodError', () => {
    try {
      createRemoteSystemConfigSchema.parse({ ...valid, baseUrl: 'not-a-url' });
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const mapped = mapZodError(err as ZodError);
      expect(mapped.messageKey).toBe('error.remoteConfigBaseUrlInvalid');
    }
  });
});

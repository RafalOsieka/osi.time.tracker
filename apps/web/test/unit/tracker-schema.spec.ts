import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import {
  createTrackerSchema,
  trackerDirectBrowserAccessSchema,
  trackerRoundingRuleSchema,
} from '../../shared/types/tracker';
import { mapZodError } from '../../server/utils/zod-error';

describe('tracker connection field schemas', () => {
  const valid = {
    name: 'My Tracker',
    systemType: 'redmine',
    baseUrl: 'https://redmine.example.com',
    directBrowserAccess: true,
    roundingRule: 'none',
  };

  it('parses a valid tracker body', () => {
    const result = createTrackerSchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it('rejects a missing baseUrl', () => {
    const { baseUrl: _ignored, ...rest } = valid;
    expect(() => createTrackerSchema.parse(rest)).toThrow();
  });

  it('rejects an invalid baseUrl', () => {
    expect(() => createTrackerSchema.parse({ ...valid, baseUrl: 'not-a-url' })).toThrow();
  });

  it('rejects an unknown systemType', () => {
    expect(() => createTrackerSchema.parse({ ...valid, systemType: 'jira' })).toThrow();
  });

  it('defaults directBrowserAccess to true when omitted', () => {
    const { directBrowserAccess: _ignored, ...rest } = valid;
    const result = createTrackerSchema.parse(rest);
    expect(result.directBrowserAccess).toBe(true);
  });

  it('rejects the obsolete executionMode field', () => {
    expect(() => createTrackerSchema.parse({ ...valid, executionMode: 'server' })).toThrow(
      ZodError,
    );
  });

  it('accepts an explicit false directBrowserAccess', () => {
    const result = createTrackerSchema.parse({ ...valid, directBrowserAccess: false });
    expect(result.directBrowserAccess).toBe(false);
  });

  it('rejects a non-boolean directBrowserAccess', () => {
    expect(() => createTrackerSchema.parse({ ...valid, directBrowserAccess: 'true' })).toThrow();
  });

  it('no longer exposes a transportMode field', () => {
    const result = createTrackerSchema.parse(valid);
    expect('transportMode' in result).toBe(false);
    expect('executionMode' in result).toBe(false);
  });

  it('strips a secret field submitted alongside a valid body', () => {
    const result = createTrackerSchema.parse({
      ...valid,
      apiKey: 'super-secret',
      secret: 'super-secret',
    });
    expect('apiKey' in result).toBe(false);
    expect('secret' in result).toBe(false);
  });

  it('strips requiredFieldDefaults submitted alongside a valid body', () => {
    const result = createTrackerSchema.parse({
      ...valid,
      requiredFieldDefaults: { activity: '1' },
    });
    expect('requiredFieldDefaults' in result).toBe(false);
    expect(result).toEqual(valid);
  });

  it('maps validation failures to { messageKey, params } via mapZodError', () => {
    try {
      createTrackerSchema.parse({ ...valid, baseUrl: 'not-a-url' });
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      if (!(err instanceof ZodError)) throw err;
      const mapped = mapZodError(err);
      expect(mapped.messageKey).toBe('error.trackerBaseUrlInvalid');
    }
  });

  it('accepts nearest_* rounding rules', () => {
    for (const roundingRule of ['nearest_15m', 'nearest_30m', 'nearest_1h'] as const) {
      const result = createTrackerSchema.parse({ ...valid, roundingRule });
      expect(result.roundingRule).toBe(roundingRule);
    }
  });

  it('rejects an unknown rounding rule', () => {
    expect(() => createTrackerSchema.parse({ ...valid, roundingRule: 'bankers_15m' })).toThrow(
      ZodError,
    );
  });

  it('exports standalone schemas used by adapters', () => {
    expect(trackerSystemTypeSchema.parse('openproject')).toBe('openproject');
    expect(trackerDirectBrowserAccessSchema.parse(true)).toBe(true);
    expect(() => trackerDirectBrowserAccessSchema.parse('true')).toThrow(ZodError);
    expect(trackerRoundingRuleSchema.parse('up_15m')).toBe('up_15m');
  });
});

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  createTrackerSchema,
  trackerExecutionModeSchema,
  trackerRoundingRuleSchema,
  trackerSystemTypeSchema,
} from '../../shared/types/tracker';
import { mapZodError } from '../../server/utils/zod-error';

describe('tracker connection field schemas', () => {
  const valid = {
    name: 'My Tracker',
    systemType: 'redmine',
    baseUrl: 'https://redmine.example.com',
    executionMode: 'client',
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

  it('defaults executionMode to client when omitted', () => {
    const { executionMode: _ignored, ...rest } = valid;
    const result = createTrackerSchema.parse(rest);
    expect(result.executionMode).toBe('client');
  });

  it('accepts an explicit server executionMode', () => {
    const result = createTrackerSchema.parse({ ...valid, executionMode: 'server' });
    expect(result.executionMode).toBe('server');
  });

  it('rejects an invalid executionMode', () => {
    expect(() => createTrackerSchema.parse({ ...valid, executionMode: 'tunneled' })).toThrow();
  });

  it('no longer exposes a transportMode field', () => {
    const result = createTrackerSchema.parse(valid);
    expect('transportMode' in result).toBe(false);
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

  it('exports standalone enums used by adapters', () => {
    expect(trackerSystemTypeSchema.parse('openproject')).toBe('openproject');
    expect(trackerExecutionModeSchema.parse('server')).toBe('server');
    expect(trackerRoundingRuleSchema.parse('up_15m')).toBe('up_15m');
  });
});

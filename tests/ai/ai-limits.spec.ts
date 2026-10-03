import { describe, expect, it } from 'vitest';
import { AI_LIMITS, checkRateLimit } from '../../src/ai/infrastructure/ai-limits';

describe('checkRateLimit', () => {
  it('allows usage below limits', () => {
    expect(checkRateLimit({ lastMinute: 0, lastDay: 0 })).toEqual({
      allowed: true,
      reason: 'ok',
    });
    expect(
      checkRateLimit({
        lastMinute: AI_LIMITS.maxPerMinute - 1,
        lastDay: AI_LIMITS.maxPerDay - 1,
      })
    ).toEqual({ allowed: true, reason: 'ok' });
  });

  it('blocks when per-minute limit is reached', () => {
    expect(
      checkRateLimit({ lastMinute: AI_LIMITS.maxPerMinute, lastDay: 0 })
    ).toEqual({ allowed: false, reason: 'per-minute' });
  });

  it('blocks when daily limit is reached', () => {
    expect(
      checkRateLimit({ lastMinute: 0, lastDay: AI_LIMITS.maxPerDay })
    ).toEqual({ allowed: false, reason: 'per-day' });
  });

  it('per-minute takes precedence over per-day', () => {
    expect(
      checkRateLimit({
        lastMinute: AI_LIMITS.maxPerMinute,
        lastDay: AI_LIMITS.maxPerDay,
      })
    ).toEqual({ allowed: false, reason: 'per-minute' });
  });
});

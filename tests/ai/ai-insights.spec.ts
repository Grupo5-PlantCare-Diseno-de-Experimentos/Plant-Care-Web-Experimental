import { describe, expect, it } from 'vitest';
import {
  buildInsightsInput,
  buildInsightsPrompt,
  insightsCacheKey,
} from '../../src/ai/infrastructure/ai-insights';

const baseSummary = {
  avgTemperature: 22,
  avgHumidity: 55,
  avgSoilMoisture: 60,
  avgLight: 500,
  totalReadings: 42,
};

describe('buildInsightsInput', () => {
  it('returns no anomalies for optimal averages', () => {
    const input = buildInsightsInput(baseSummary, {
      totalPlants: 3,
      plantsNeedingAttention: 0,
    });
    expect(input.anomalies).toEqual([]);
    expect(input.totalReadings).toBe(42);
  });

  it('detects temperature, soil and attention anomalies', () => {
    const input = buildInsightsInput(
      { ...baseSummary, avgTemperature: 32, avgSoilMoisture: 12 },
      { totalPlants: 4, plantsNeedingAttention: 2 }
    );
    expect(input.anomalies).toContain('temperature:32.0');
    expect(input.anomalies).toContain('soil:12');
    expect(input.anomalies).toContain('attention:2/4');
  });

  it('flags empty datasets', () => {
    const input = buildInsightsInput(
      { ...baseSummary, totalReadings: 0 },
      { totalPlants: 0, plantsNeedingAttention: 0 }
    );
    expect(input.anomalies).toContain('no-data');
  });
});

describe('buildInsightsPrompt + cache key', () => {
  it('builds ES and EN prompts from aggregates only', () => {
    const input = buildInsightsInput(baseSummary, {
      totalPlants: 2,
      plantsNeedingAttention: 1,
    });
    const es = buildInsightsPrompt(input, 'es');
    const en = buildInsightsPrompt(input, 'en');
    expect(es).toContain('viñetas');
    expect(en).toContain('bullets');
    expect(es).not.toContain('plant_metrics');
  });

  it('produces stable cache keys per aggregates', () => {
    const a = buildInsightsInput(baseSummary, {
      totalPlants: 2,
      plantsNeedingAttention: 0,
    });
    const b = buildInsightsInput(baseSummary, {
      totalPlants: 2,
      plantsNeedingAttention: 0,
    });
    const c = buildInsightsInput(
      { ...baseSummary, avgTemperature: 30 },
      { totalPlants: 2, plantsNeedingAttention: 0 }
    );
    expect(insightsCacheKey(a)).toBe(insightsCacheKey(b));
    expect(insightsCacheKey(a)).not.toBe(insightsCacheKey(c));
  });
});

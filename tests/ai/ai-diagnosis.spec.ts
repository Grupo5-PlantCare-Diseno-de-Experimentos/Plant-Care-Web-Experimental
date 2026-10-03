import { describe, expect, it } from 'vitest';
import type { Plant } from '../../src/plants/domain/model/plants.entity.ts';
import {
  buildDiagnosis,
  buildDiagnosisPrompt,
} from '../../src/ai/infrastructure/ai-diagnosis';

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 1,
    userId: 'u1',
    name: 'Monstera',
    type: 'interior',
    imgUrl: '',
    bio: '',
    location: '',
    status: 'healthy',
    lastWatered: new Date().toISOString(),
    nextWatering: new Date().toISOString(),
    metrics: [],
    wateringLogs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildDiagnosis', () => {
  it('returns deterministic score/status without calling Gemini', () => {
    const diagnosis = buildDiagnosis(makePlant());
    expect(diagnosis.plantId).toBe(1);
    expect(diagnosis.score).toBeGreaterThanOrEqual(0);
    expect(diagnosis.score).toBeLessThanOrEqual(100);
    expect(['healthy', 'warning', 'critical']).toContain(diagnosis.status);
    expect(diagnosis.wateringReason.length).toBeGreaterThan(0);
  });

  it('marks dry soil as urgent watering', () => {
    const diagnosis = buildDiagnosis(
      makePlant({
        metrics: [
          {
            id: 1,
            plantId: 1,
            temperatureC: 22,
            airHumidityPct: 55,
            lightLevel: 500,
            soilMoisturePct: 12,
            battery: 90,
            timestamp: new Date().toISOString(),
          },
        ],
      })
    );
    expect(diagnosis.urgency).toBe('now');
  });
});

describe('buildDiagnosisPrompt', () => {
  it('builds ES and EN prompts without raw series', () => {
    const diagnosis = buildDiagnosis(makePlant());
    const es = buildDiagnosisPrompt(diagnosis, 'es');
    const en = buildDiagnosisPrompt(diagnosis, 'en');
    expect(es).toContain('Monstera');
    expect(en).toContain('Monstera');
    expect(es).not.toContain('plant_metrics');
  });
});

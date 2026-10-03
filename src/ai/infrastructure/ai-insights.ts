import type { AiInsightInput } from '../domain/model/ai.entity.ts';

export interface AnalyticsSummaryInput {
  avgTemperature: number;
  avgHumidity: number;
  avgSoilMoisture: number;
  avgLight: number;
  totalReadings: number;
}

/**
 * Agregador puro de insights (Fase 3).
 * Detecta anomalías deterministas con los mismos umbrales del dominio:
 * temp 18-26, humedad 40-70, suelo 30-75, luz >=100.
 * Gemini solo redacta el resumen, nunca calcula los promedios.
 */
export function buildInsightsInput(
  summary: AnalyticsSummaryInput,
  totals: { totalPlants: number; plantsNeedingAttention: number }
): AiInsightInput {
  const anomalies: string[] = [];
  if (summary.totalReadings === 0) anomalies.push('no-data');
  if (summary.avgTemperature < 18 || summary.avgTemperature > 26) {
    anomalies.push(`temperature:${summary.avgTemperature.toFixed(1)}`);
  }
  if (summary.avgHumidity < 40 || summary.avgHumidity > 70) {
    anomalies.push(`humidity:${summary.avgHumidity.toFixed(0)}`);
  }
  if (summary.avgSoilMoisture < 30 || summary.avgSoilMoisture > 75) {
    anomalies.push(`soil:${summary.avgSoilMoisture.toFixed(0)}`);
  }
  if (summary.avgLight < 100) anomalies.push(`light:${summary.avgLight.toFixed(0)}`);
  if (totals.plantsNeedingAttention > 0) {
    anomalies.push(`attention:${totals.plantsNeedingAttention}/${totals.totalPlants}`);
  }

  return {
    totalPlants: totals.totalPlants,
    plantsNeedingAttention: totals.plantsNeedingAttention,
    avgTemperature: summary.avgTemperature,
    avgHumidity: summary.avgHumidity,
    avgSoilMoisture: summary.avgSoilMoisture,
    avgLight: summary.avgLight,
    totalReadings: summary.totalReadings,
    anomalies,
  };
}

export function buildInsightsPrompt(input: AiInsightInput, locale: string): string {
  const lang = locale === 'en' ? 'en' : 'es';
  const base =
    `Plants ${input.totalPlants} (attention ${input.plantsNeedingAttention}), ` +
    `avg temp ${input.avgTemperature.toFixed(1)}°C, humidity ${input.avgHumidity.toFixed(0)}%, ` +
    `soil ${input.avgSoilMoisture.toFixed(0)}%, light ${input.avgLight.toFixed(0)}, ` +
    `readings ${input.totalReadings}. Anomalies: ${input.anomalies.join('; ') || 'none'}.`;
  return lang === 'en'
    ? `Summarize these plant analytics in 3-5 short bullets (trend, anomaly, action).\n${base}`
    : `Resume estas analíticas en 3-5 viñetas cortas (tendencia, anomalía, acción).\n${base}`;
}

/** Clave de caché por agregados (ahorra cuota gratuita). */
export function insightsCacheKey(input: AiInsightInput): string {
  return [
    'ai_insights',
    input.totalPlants,
    input.plantsNeedingAttention,
    input.avgTemperature.toFixed(1),
    input.avgHumidity.toFixed(0),
    input.avgSoilMoisture.toFixed(0),
    input.avgLight.toFixed(0),
    input.totalReadings,
  ].join('_');
}

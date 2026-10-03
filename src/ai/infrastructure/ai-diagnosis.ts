import type { Plant } from '../../plants/domain/model/plants.entity.ts';
import { calculateHealthScore } from '../../plants/application/healthScore';
import { computeNextWatering } from '../../plants/application/nextWatering';
import { computePlantHealth } from '../../plants/application/plantHealth';
import type { AiDiagnosis } from '../domain/model/ai.entity.ts';

/**
 * Constructor puro de diagnóstico (Fase 2).
 * Reutiliza helpers deterministas existentes: NO duplicar umbrales.
 * Gemini solo explica este resultado, nunca lo sustituye.
 */
export function buildDiagnosis(plant: Plant): AiDiagnosis {
  const scored = calculateHealthScore(plant);
  const watering = computeNextWatering(plant);
  const health = computePlantHealth(plant);

  return {
    plantId: plant.id,
    plantName: plant.name,
    score: scored.score,
    status: scored.status,
    details: scored.details,
    nextWatering: watering.nextWatering,
    urgency: watering.urgency,
    daysUntilWatering: watering.daysUntilWatering,
    wateringReason: watering.reason,
    metricReason: health.reason,
  };
}

/**
 * Prompt estructurado para pedir a Gemini la explicación del diagnóstico.
 * Se envía vía AiService.sendMessage (Edge Function ai-chat).
 */
export function buildDiagnosisPrompt(diagnosis: AiDiagnosis, locale: string): string {
  const lang = locale === 'en' ? 'en' : 'es';
  if (lang === 'en') {
    return [
      `Explain this deterministic plant diagnosis in 4 short bullets (status, cause, watering plan, next action).`,
      `Plant ${diagnosis.plantName}: score ${diagnosis.score}/100 (${diagnosis.status}).`,
      `Signals: ${diagnosis.details.join('; ') || 'all optimal'}.`,
      `Watering: ${diagnosis.wateringReason} (urgency ${diagnosis.urgency}, in ${diagnosis.daysUntilWatering.toFixed(1)} days).`,
      `Metrics: ${diagnosis.metricReason}.`,
    ].join('\n');
  }
  return [
    `Explica este diagnóstico determinista en 4 viñetas cortas (estado, causa, plan de riego, próxima acción).`,
    `Planta ${diagnosis.plantName}: ${diagnosis.score}/100 (${diagnosis.status}).`,
    `Señales: ${diagnosis.details.join('; ') || 'todo óptimo'}.`,
    `Riego: ${diagnosis.wateringReason} (urgencia ${diagnosis.urgency}, en ${diagnosis.daysUntilWatering.toFixed(1)} días).`,
    `Métricas: ${diagnosis.metricReason}.`,
  ].join('\n');
}

import { supabase } from '../../utils/supabase';
import { computeMetricStatus } from '../../plants/application/plantHealth';

/**
 * Insignia "Cuidador Experto" (Hipótesis 5 — Gamificación).
 *
 * Se desbloquea cuando TODAS las plantas del usuario se mantienen sin estado
 * crítico durante 7 días consecutivos. Un día se considera "con alerta crítica"
 * si alguna lectura de cualquier planta evaluó a `status === 'critical'`
 * (coherente con la salud que ve el usuario en el resto de la app).
 */
export const EXPERT_STREAK_DAYS = 7;
export const EXPERT_ACHIEVEMENT_ID = 'expert_caretaker';

/** Clave de día en formato YYYY-MM-DD (UTC) para agrupar lecturas. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Función pura: cuenta los días consecutivos sin alerta crítica contando desde
 * `today` hacia atrás. Un día sin lecturas NO rompe la racha (gaps del sensor).
 */
export function consecutiveSafeDays(
  criticalDayKeys: Iterable<string>,
  today: Date = new Date(),
  maxDays: number = EXPERT_STREAK_DAYS
): number {
  const criticalSet = new Set(criticalDayKeys);
  let streak = 0;

  for (let i = 0; i < maxDays; i++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);
    if (criticalSet.has(dayKey(day))) break;
    streak++;
  }
  return streak;
}

export interface ExpertCaretakerResult {
  streakDays: number;
  unlocked: boolean;
}

/**
 * Calcula la racha actual del usuario consultando las lecturas de los últimos
 * 7 días en Supabase. No lanza: ante cualquier error devuelve racha 0.
 */
export async function computeExpertCaretakerStreak(userId: string): Promise<ExpertCaretakerResult> {
  try {
    const { data: plants, error: plantsError } = await supabase
      .from('plants')
      .select('id')
      .eq('user_id', userId);

    if (plantsError || !plants || plants.length === 0) {
      return { streakDays: 0, unlocked: false };
    }

    const plantIds = plants.map((p) => p.id);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - EXPERT_STREAK_DAYS);

    const { data: metrics, error: metricsError } = await supabase
      .from('plant_metrics')
      .select('*')
      .in('plant_id', plantIds)
      .gte('timestamp', since.toISOString());

    if (metricsError) return { streakDays: 0, unlocked: false };

    const criticalDays = new Set<string>();
    for (const reading of metrics || []) {
      const ts = (reading as any).timestamp ?? (reading as any).created_at;
      if (!ts) continue;
      if (computeMetricStatus(reading).status === 'critical') {
        criticalDays.add(dayKey(new Date(ts)));
      }
    }

    const streakDays = consecutiveSafeDays(criticalDays);
    return { streakDays, unlocked: streakDays >= EXPERT_STREAK_DAYS };
  } catch {
    return { streakDays: 0, unlocked: false };
  }
}

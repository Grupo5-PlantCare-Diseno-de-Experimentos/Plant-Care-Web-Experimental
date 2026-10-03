/**
 * Límites de uso del módulo Ai (capa gratuita Gemini 2.5 Flash).
 * La Edge Function `supabase/functions/ai-chat` aplica los mismos valores
 * en servidor (fuente de verdad); este módulo existe para testear la
 * decisión y documentar los umbrales en un solo lugar del frontend.
 */
export const AI_LIMITS = {
  maxPerMinute: 15,
  maxPerDay: 100,
} as const;

export interface AiUsageCounts {
  lastMinute: number;
  lastDay: number;
}

export interface AiRateLimitDecision {
  allowed: boolean;
  reason: 'ok' | 'per-minute' | 'per-day';
}

export function checkRateLimit(counts: AiUsageCounts): AiRateLimitDecision {
  if (counts.lastMinute >= AI_LIMITS.maxPerMinute) {
    return { allowed: false, reason: 'per-minute' };
  }
  if (counts.lastDay >= AI_LIMITS.maxPerDay) {
    return { allowed: false, reason: 'per-day' };
  }
  return { allowed: true, reason: 'ok' };
}

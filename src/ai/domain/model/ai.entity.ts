/**
 * Bounded context Ai — entidades de dominio puras.
 * Sin imports de Vue/Pinia/Supabase. Solo tipos + guards.
 */

export type AiRole = 'user' | 'assistant';

export interface AiMessage {
  id: string;
  conversationId: string | null;
  role: AiRole;
  content: string;
  model: string;
  promptTokens: number | null;
  responseTokens: number | null;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  plantId: number | null;
  title: string;
  createdAt: string;
}

/** Subconjunto agregado de planta que se envía como contexto a Gemini.
 *  No enviar series crudas de plant_metrics para cuidar la cuota gratuita.
 */
export interface AiPlantContext {
  id: number;
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  lastWatered: string;
  nextWatering: string;
  healthScore: number | null;
  avgHumidity: number | null;
  totalPlants: number;
}

export interface AiPromptPayload {
  prompt: string;
  conversationId: string | null;
  plantId: number | null;
  context: AiPlantContext | null;
  locale: string;
  /** Si true, la Edge Function responde SSE en vez de JSON. */
  stream?: boolean;
}

export interface AiReply {
  reply: string;
  conversationId: string | null;
  model: string;
  promptTokens: number | null;
  responseTokens: number | null;
}

/** Estado discriminado para streaming (typescript-advanced-types). */
export type AiState =
  | { status: 'idle' }
  | { status: 'streaming'; requestId: string }
  | { status: 'success'; data: AiMessage }
  | { status: 'error'; error: string };

/** Diagnóstico determinista (no lo genera Gemini, lo explica). */
export interface AiDiagnosis {
  plantId: number;
  plantName: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  details: string[];
  nextWatering: string | null;
  urgency: 'now' | 'soon' | 'normal' | 'flexible';
  daysUntilWatering: number;
  wateringReason: string;
  metricReason: string;
}

/** Insight determinista previo a la explicación IA (Fase 3). */
export interface AiInsightInput {
  totalPlants: number;
  plantsNeedingAttention: number;
  avgTemperature: number;
  avgHumidity: number;
  avgSoilMoisture: number;
  avgLight: number;
  totalReadings: number;
  anomalies: string[];
}

/** Cliente type-safe de la Edge Function (seam). */
export interface AiChatEndpoint {
  '/ai-chat': {
    POST: { body: AiPromptPayload; response: AiReply };
  };
}

export type AiEventName = `on${Capitalize<'prompt' | 'abort' | 'retry'>}`;

export function isAiReply(value: unknown): value is AiReply {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.reply === 'string' && typeof v.model === 'string';
}

export function assertAiReply(value: unknown): asserts value is AiReply {
  if (!isAiReply(value)) throw new Error('Invalid AiReply payload');
}

export function createUserMessage(
  content: string,
  conversationId: string | null = null
): Omit<AiMessage, 'id' | 'createdAt'> {
  return {
    conversationId,
    role: 'user',
    content,
    model: 'client',
    promptTokens: null,
    responseTokens: null,
  };
}

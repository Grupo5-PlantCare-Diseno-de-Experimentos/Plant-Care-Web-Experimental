import type {
  AiConversation,
  AiMessage,
  AiPlantContext,
} from '../domain/model/ai.entity.ts';

type Row = Record<string, unknown>;

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** Assembler snake_case Supabase <-> camelCase dominio (patrón plants). */
export class AiAssembler {
  static conversationToDomain(raw: Row): AiConversation {
    return {
      id: String(raw.id),
      userId: String(raw.user_id),
      plantId:
        raw.plant_id === null || raw.plant_id === undefined
          ? null
          : Number(raw.plant_id),
      title: String(raw.title ?? 'Nueva conversación'),
      createdAt: String(raw.created_at ?? new Date().toISOString()),
    };
  }

  static messageToDomain(raw: Row): AiMessage {
    const role = raw.role === 'assistant' ? 'assistant' : 'user';
    return {
      id: String(raw.id),
      conversationId: toNullableString(raw.conversation_id),
      role,
      content: String(raw.content ?? ''),
      model: String(raw.model ?? 'gemini-2.5-flash'),
      promptTokens: toNullableNumber(raw.prompt_tokens),
      responseTokens: toNullableNumber(raw.response_tokens),
      createdAt: String(raw.created_at ?? new Date().toISOString()),
    };
  }

  /**
   * Construye el contexto agregado para Gemini.
   * Solo agregados (score, promedios, conteos). Nunca series crudas.
   */
  static buildPromptContext(input: {
    plants: Array<{
      id: number;
      name: string;
      type: string;
      status: 'healthy' | 'warning' | 'critical';
      lastWatered: string;
      nextWatering: string;
    }>;
    focusedPlantId?: number | null;
    healthScore?: number | null;
    avgHumidity?: number | null;
  }): AiPlantContext | null {
    if (input.plants.length === 0) return null;
    const focused =
      input.plants.find((p) => p.id === input.focusedPlantId) ??
      input.plants[0];
    if (!focused) return null;
    return {
      id: focused.id,
      name: focused.name,
      type: focused.type,
      status: focused.status,
      lastWatered: focused.lastWatered,
      nextWatering: focused.nextWatering,
      healthScore: input.healthScore ?? null,
      avgHumidity: input.avgHumidity ?? null,
      totalPlants: input.plants.length,
    };
  }
}

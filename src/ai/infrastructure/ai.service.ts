import { supabase } from '../../utils/supabase';
import type {
  AiConversation,
  AiDiagnosis,
  AiInsightInput,
  AiMessage,
  AiPlantContext,
  AiPromptPayload,
  AiReply,
} from '../domain/model/ai.entity.ts';
import { AiAssembler, } from './ai-assembler';
import { assertAiReply } from '../domain/model/ai.entity.ts';
import { buildDiagnosisPrompt } from './ai-diagnosis';
import { buildInsightsPrompt } from './ai-insights';
import { createSseParser } from './ai-stream';

type ServiceResponse<T> = {
  data: T;
};

/**
 * La Edge Function ausente se manifiesta como 404 del gateway (que el
 * navegador suele enmascarar como error CORS en el preflight) o como
 * fallo de red. supabase-js lo envuelve en FunctionsHttpError /
 * FunctionsFetchError con mensaje genérico, así que se inspecciona el
 * `context` (Response crudo) y el `name`. Se traduce a un mensaje
 * accionable en vez del error crudo.
 */
export async function toFriendlyFunctionError(e: unknown): Promise<Error> {
  const asRecord = e as {
    name?: unknown;
    status?: unknown;
    message?: unknown;
    context?: unknown;
  };
  const contextStatus = (asRecord.context as { status?: unknown } | undefined)
    ?.status;
  const status =
    typeof asRecord.status === 'number' ? asRecord.status : contextStatus;
  if (status === 404) {
    return new Error(
      'El servicio IA no está disponible: la Edge Function ai-chat no está desplegada en este proyecto Supabase (ver docs/DEPLOY_AI.md).'
    );
  }

  const name = typeof asRecord.name === 'string' ? asRecord.name : '';
  const message = e instanceof Error ? e.message : String(e);
  if (
    name === 'FunctionsFetchError' ||
    name === 'FunctionsRelayError' ||
    /failed to send a request/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /ERR_FAILED/i.test(message)
  ) {
    return new Error(
      'El servicio IA no está disponible: la Edge Function ai-chat no está desplegada en este proyecto Supabase (ver docs/DEPLOY_AI.md).'
    );
  }

  // Errores de la función desplegada (429 cuota, 500, 401): rescata su mensaje.
  if (asRecord.context instanceof Response) {
    try {
      const body = (await asRecord.context
        .clone()
        .json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.length > 0) {
        if (body.error.toLowerCase() === 'unauthorized') {
          return new Error('Sesión no autorizada o expirada. Por favor, inicia sesión nuevamente.');
        }
        return new Error(body.error);
      }
    } catch {
      /* conserva el mensaje original */
    }
  }
  if (status === 401) {
    return new Error('Sesión no autorizada o expirada. Por favor, inicia sesión nuevamente.');
  }
  if (typeof status === 'number') {
    return new Error(`El servicio IA devolvió un error (HTTP ${status}).`);
  }
  return e instanceof Error ? e : new Error(message);
}

/**
 * Adapter de infraestructura: solo habla con la Edge Function
 * `ai-chat` vía supabase.functions.invoke. Nunca llama a Google directo
 * (la GEMINI_API_KEY vive como secreto en servidor, no VITE_*).
 */
export class AiService {
  private wrapResponse<T>(data: T): ServiceResponse<T> {
    return { data };
  }

  async sendMessage(payload: AiPromptPayload, signal?: AbortSignal): Promise<ServiceResponse<AiReply>> {
    if (!payload.prompt || payload.prompt.trim().length === 0) {
      throw new Error('Invalid prompt: prompt must not be empty');
    }
    if (payload.prompt.length > 4000) {
      throw new Error('Invalid prompt: prompt exceeds 4000 characters');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Debes iniciar sesión para usar el asistente de IA.');
    }

    let data: unknown;
    let error: unknown;
    try {
      ({ data, error } = await supabase.functions.invoke('ai-chat', {
        body: payload,
      }));
    } catch (e: unknown) {
      throw await toFriendlyFunctionError(e);
    }

    if (signal?.aborted) throw new Error('Request aborted by user');

    if (error) throw await toFriendlyFunctionError(error);
    assertAiReply(data);
    return this.wrapResponse(data);
  }

  async getConversations(): Promise<ServiceResponse<AiConversation[]>> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    return this.wrapResponse(rows.map((r) => AiAssembler.conversationToDomain(r)));
  }

  async getMessages(conversationId: string): Promise<ServiceResponse<AiMessage[]>> {
    if (!conversationId) throw new Error('Invalid conversationId');
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    return this.wrapResponse(rows.map((r) => AiAssembler.messageToDomain(r)));
  }

  /**
   * Borra una conversación propia (RLS FOR ALL por user_id).
   * Los mensajes se borran en cascada (FK ON DELETE CASCADE).
   */
  async deleteConversation(conversationId: string): Promise<ServiceResponse<null>> {
    if (!conversationId) throw new Error('Invalid conversationId');
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
    return this.wrapResponse(null);
  }

  /** Renombra una conversación propia. Título 1..120 caracteres. */
  async renameConversation(conversationId: string, title: string): Promise<ServiceResponse<AiConversation>> {
    if (!conversationId) throw new Error('Invalid conversationId');
    const trimmed = title.trim().slice(0, 120);
    if (!trimmed) throw new Error('Invalid title: title must not be empty');
    const { data, error } = await supabase
      .from('ai_conversations')
      .update({ title: trimmed })
      .eq('id', conversationId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Conversation not found');
    return this.wrapResponse(AiAssembler.conversationToDomain(data as Record<string, unknown>));
  }

  /**
   * Fase 2: pide a Gemini la explicación del diagnóstico determinista.
   * Reutiliza sendMessage (misma Edge Function ai-chat, sin nueva infra).
   */
  async requestExplanation(
    diagnosis: AiDiagnosis,
    context: AiPlantContext | null,
    locale = 'es',
    signal?: AbortSignal
  ): Promise<ServiceResponse<AiReply>> {
    return this.sendMessage(
      {
        prompt: buildDiagnosisPrompt(diagnosis, locale),
        conversationId: null,
        plantId: diagnosis.plantId,
        context,
        locale,
      },
      signal
    );
  }

  /**
   * Fase 6: pide a Gemini el resumen de analíticas agregadas.
   * Misma Edge Function ai-chat; el caché vive en el store (metrics-cache).
   */
  async requestInsights(
    input: AiInsightInput,
    locale = 'es',
    signal?: AbortSignal
  ): Promise<ServiceResponse<AiReply>> {
    return this.sendMessage(
      {
        prompt: buildInsightsPrompt(input, locale),
        conversationId: null,
        plantId: null,
        context: null,
        locale,
      },
      signal
    );
  }

  /**
   * Fase 6: chat con streaming SSE token a token.
   * `functions.invoke` no soporta SSE, por eso se usa `fetch` directo con
   * la misma autenticación (apikey pública + JWT de sesión). La
   * GEMINI_API_KEY nunca sale del servidor.
   */
  async sendMessageStream(
    payload: AiPromptPayload,
    opts: { onToken: (token: string) => void; signal?: AbortSignal }
  ): Promise<{ conversationId: string | null; model: string }> {
    if (!payload.prompt || payload.prompt.trim().length === 0) {
      throw new Error('Invalid prompt: prompt must not be empty');
    }
    if (payload.prompt.length > 4000) {
      throw new Error('Invalid prompt: prompt exceeds 4000 characters');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Debes iniciar sesión para usar el asistente de IA.');
    }

    // Misma base que src/utils/supabase.ts (vars públicas, ya en el bundle).
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    let response: Response;
    try {
      // eslint-disable-next-line no-console
      console.debug('[AiService] prefetch', { aborted: opts.signal?.aborted ?? null });
      response = await fetch(
        `${supabaseUrl}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ...payload, stream: true }),
          signal: opts.signal,
        }
      );
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.debug('[AiService] stream fetch threw', {
        aborted: opts.signal?.aborted ?? null,
        message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      });
      if (opts.signal?.aborted) throw e;
      throw await toFriendlyFunctionError(e);
    }

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.debug('[AiService] stream not-ok', response.status);
      if (response.status === 404) {
        throw await toFriendlyFunctionError({ status: 404 });
      }
      let message = `AI stream error: ${response.status}`;
      try {
        const errJson = (await response.json()) as { error?: unknown };
        if (typeof errJson.error === 'string') message = errJson.error;
      } catch {
        /* conserva el mensaje por defecto */
      }
      throw new Error(message);
    }
    if (!response.body) throw new Error('AI stream error: empty body');

    // eslint-disable-next-line no-console
    console.debug('[AiService] stream status', response.status, response.headers.get('Content-Type'));

    const conversationId = response.headers.get('X-Conversation-Id');
    // Si el backend responde JSON clásico (no SSE), no hay tokens:
    // se lanza error para que el store use el fallback garantizado.
    let tokenCount = 0;
    const parser = createSseParser((token) => {
      tokenCount += 1;
      opts.onToken(token);
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      parser.flush();
    } finally {
      reader.releaseLock();
    }
    if (tokenCount === 0) throw new Error('AI stream error: no tokens received');
    // eslint-disable-next-line no-console
    console.debug('[AiService] stream tokens', tokenCount);
    return { conversationId, model: 'gemini-2.5-flash' };
  }
}

export const aiService = new AiService();

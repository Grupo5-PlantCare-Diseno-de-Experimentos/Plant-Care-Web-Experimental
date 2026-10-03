import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  AiConversation,
  AiDiagnosis,
  AiInsightInput,
  AiMessage,
  AiPlantContext,
} from '../domain/model/ai.entity.ts';
import { AiService } from '../infrastructure/ai.service';
import { insightsCacheKey } from '../infrastructure/ai-insights';
import { withCache } from '../../experiments/cache/metrics-cache';
import { trackingService } from '../../experiments/tracking/tracking.service';

/**
 * Store Ai (Setup Store, patrón plants.store.ts).
 * El contexto de plantas se recibe por parámetro para evitar
 * dependencias circulares entre stores (skill pinia).
 */
export const useAiStore = defineStore('ai', () => {
  const aiService = new AiService();

  const messages = ref<AiMessage[]>([]);
  const conversations = ref<AiConversation[]>([]);
  const activeConversationId = ref<string | null>(null);
  const loading = ref(false);
  const streaming = ref(false);
  const error = ref<string | null>(null);
  const abortController = ref<AbortController | null>(null);

  const visibleMessages = computed(() => messages.value);
  const hasMessages = computed(() => messages.value.length > 0);

  const getErrorMessage = (e: unknown): string => {
    return e instanceof Error ? e.message : 'No se pudo contactar al asistente';
  };

  const loadConversations = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await aiService.getConversations();
      conversations.value = response.data;
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  };

  const loadMessages = async (conversationId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await aiService.getMessages(conversationId);
      activeConversationId.value = conversationId;
      messages.value = response.data;
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  };

  const sendPrompt = async (
    prompt: string,
    context: AiPlantContext | null,
    options: { plantId?: number | null; locale?: string } = {}
  ) => {
    // Llamar a todos los stores/servicios antes del primer await (skill pinia).
    const trimmed = prompt.trim();
    if (!trimmed) {
      error.value = 'Escribe una pregunta primero';
      return;
    }

    abortController.value?.abort();
    const controller = new AbortController();
    abortController.value = controller;

    const optimisticUserMsg: AiMessage = {
      id: `local-${Date.now()}`,
      conversationId: activeConversationId.value,
      role: 'user',
      content: trimmed,
      model: 'client',
      promptTokens: null,
      responseTokens: null,
      createdAt: new Date().toISOString(),
    };
    messages.value = [...messages.value, optimisticUserMsg];

    loading.value = true;
    streaming.value = true;
    error.value = null;

    const payload = {
      prompt: trimmed,
      conversationId: activeConversationId.value,
      plantId: options.plantId ?? context?.id ?? null,
      context,
      locale: options.locale ?? 'es',
    };

    // Placeholder del asistente: los tokens se añaden de forma inmutable.
    const placeholderId = `ai-stream-${Date.now()}`;
    const appendToken = (token: string): void => {
      messages.value = messages.value.map((m) =>
        m.id === placeholderId ? { ...m, content: m.content + token } : m
      );
    };

    const trackPrompt = (responseTokens: number | null): void => {
      trackingService.track({
        eventName: 'ai_prompt',
        location: 'ai',
        metadata: {
          promptLength: trimmed.length,
          plantId: options.plantId ?? context?.id ?? null,
          responseTokens,
        },
      });
    };

    const fail = (e: unknown): never => {
      if (controller.signal.aborted) {
        error.value = 'Solicitud cancelada';
      } else {
        error.value = getErrorMessage(e);
      }
      throw e;
    };

    try {
      // Fase 6: streaming SSE con fallback al JSON clásico si el stream
      // falla antes del primer token (p. ej. proxies sin SSE).
      let receivedFirstToken = false;
      messages.value = [
        ...messages.value,
        {
          id: placeholderId,
          conversationId: activeConversationId.value,
          role: 'assistant',
          content: '',
          model: 'gemini-2.5-flash',
          promptTokens: null,
          responseTokens: null,
          createdAt: new Date().toISOString(),
        },
      ];
      try {
        const streamRes = await aiService.sendMessageStream(payload, {
          onToken: (token) => {
            receivedFirstToken = true;
            appendToken(token);
          },
          signal: controller.signal,
        });
        if (streamRes.conversationId) {
          activeConversationId.value = streamRes.conversationId;
          messages.value = messages.value.map((m) =>
            m.id === placeholderId
              ? { ...m, conversationId: streamRes.conversationId }
              : m
          );
        }
        trackPrompt(null);
      } catch (streamError: unknown) {
        if (controller.signal.aborted) return fail(streamError);
        if (!receivedFirstToken) {
          // Fallback clásico: quita el placeholder y pide JSON completo.
          messages.value = messages.value.filter((m) => m.id !== placeholderId);
          const response = await aiService.sendMessage(payload, controller.signal);
          if (response.data.conversationId) {
            activeConversationId.value = response.data.conversationId;
          }
          const assistantMsg: AiMessage = {
            id: `ai-${Date.now()}`,
            conversationId: activeConversationId.value,
            role: 'assistant',
            content: response.data.reply,
            model: response.data.model,
            promptTokens: response.data.promptTokens,
            responseTokens: response.data.responseTokens,
            createdAt: new Date().toISOString(),
          };
          messages.value = [...messages.value, assistantMsg];
          trackPrompt(response.data.responseTokens);
        } else {
          // Stream parcial: se conserva lo recibido + error reintentable.
          error.value = getErrorMessage(streamError);
        }
      }
    } catch (e: unknown) {
      return fail(e);
    } finally {
      loading.value = false;
      streaming.value = false;
      if (abortController.value === controller) abortController.value = null;
    }
  };

  const abort = () => {
    abortController.value?.abort();
  };

  const retry = async (lastPrompt: string, context: AiPlantContext | null, locale = 'es') => {
    // Reintento simple (un solo intento extra lo gestiona la Edge Function).
    messages.value = messages.value.filter((m) => !m.id.startsWith('local-'));
    await sendPrompt(lastPrompt, context, { locale });
  };

  const startNewConversation = () => {
    activeConversationId.value = null;
    messages.value = [];
    error.value = null;
  };

  /** Borra una conversación (una por una, con confirmación en la vista). */
  const deleteConversation = async (conversationId: string) => {
    if (!conversationId) {
      error.value = 'Conversación inválida';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      await aiService.deleteConversation(conversationId);
      conversations.value = conversations.value.filter((c) => c.id !== conversationId);
      if (activeConversationId.value === conversationId) {
        activeConversationId.value = null;
        messages.value = [];
        clearExplanation();
      }
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      loading.value = false;
    }
  };

  /** Renombra una conversación propia. */
  const renameConversation = async (conversationId: string, title: string) => {
    const trimmed = title.trim().slice(0, 120);
    if (!conversationId || !trimmed) {
      error.value = 'Escribe un título válido';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const response = await aiService.renameConversation(conversationId, trimmed);
      conversations.value = conversations.value.map((c) =>
        c.id === conversationId ? { ...c, title: response.data.title } : c
      );
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // Fase 2: explicación IA del diagnóstico determinista.
  const explanation = ref<string | null>(null);
  const explanationLoading = ref(false);
  const explanationError = ref<string | null>(null);

  const requestExplanation = async (
    diagnosis: AiDiagnosis,
    context: AiPlantContext | null,
    locale = 'es'
  ) => {
    explanationLoading.value = true;
    explanationError.value = null;
    try {
      const response = await aiService.requestExplanation(diagnosis, context, locale);
      explanation.value = response.data.reply;
      trackingService.track({
        eventName: 'ai_explanation',
        location: 'ai',
        metadata: { plantId: diagnosis.plantId },
      });
    } catch (e: unknown) {
      explanationError.value = getErrorMessage(e);
      // Fallback: sin cuota/red, la vista muestra el diagnóstico determinista.
    } finally {
      explanationLoading.value = false;
    }
  };

  const clearExplanation = () => {
    explanation.value = null;
    explanationError.value = null;
  };

  // Fase 3: insights de analíticas (con caché para ahorrar cuota gratuita).
  const insights = ref<string | null>(null);
  const insightsLoading = ref(false);
  const insightsError = ref<string | null>(null);

  const requestInsights = async (input: AiInsightInput, locale = 'es') => {
    insightsLoading.value = true;
    insightsError.value = null;
    try {
      const reply = await withCache(
        insightsCacheKey(input),
        async () => {
          const response = await aiService.requestInsights(input, locale);
          return response.data.reply;
        },
        5 * 60 * 1000
      );
      insights.value = reply;
      trackingService.track({
        eventName: 'ai_insights',
        location: 'analytics',
        metadata: { totalReadings: input.totalReadings },
      });
    } catch (e: unknown) {
      insightsError.value = getErrorMessage(e);
      // Fallback: la vista muestra las anomalías deterministas.
    } finally {
      insightsLoading.value = false;
    }
  };

  const clearInsights = () => {
    insights.value = null;
    insightsError.value = null;
  };

  return {
    messages,
    conversations,
    activeConversationId,
    loading,
    streaming,
    error,
    visibleMessages,
    hasMessages,
    loadConversations,
    loadMessages,
    sendPrompt,
    abort,
    retry,
    startNewConversation,
    deleteConversation,
    renameConversation,
    explanation,
    explanationLoading,
    explanationError,
    requestExplanation,
    clearExplanation,
    insights,
    insightsLoading,
    insightsError,
    requestInsights,
    clearInsights,
    $reset: () => {
      messages.value = [];
      conversations.value = [];
      activeConversationId.value = null;
      loading.value = false;
      streaming.value = false;
      error.value = null;
      explanation.value = null;
      explanationLoading.value = false;
      explanationError.value = null;
      insights.value = null;
      insightsLoading.value = false;
      insightsError.value = null;
      abortController.value?.abort();
      abortController.value = null;
    },
  };
});

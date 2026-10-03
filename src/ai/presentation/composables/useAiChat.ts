import { readonly, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAiStore } from '../../application/ai.store';
import type { AiPlantContext } from '../../domain/model/ai.entity.ts';

interface UseAiChatOptions {
  timeoutMs?: number;
  maxPromptLength?: number;
}

/**
 * Composable fino para la vista Ai (skill vue-best-practices):
 * la vista compone, el store guarda, este composable orquesta.
 */
export function useAiChat(options: UseAiChatOptions = {}) {
  const { timeoutMs = 60000, maxPromptLength = 4000 } = options;
  const store = useAiStore();
  const { messages, loading, streaming, error } = storeToRefs(store);
  const { sendPrompt, abort, startNewConversation } = store;

  const prompt = ref('');
  const lastPrompt = ref('');

  const canSend = () => prompt.value.trim().length > 0 && !loading.value;

  const send = async (context: AiPlantContext | null, locale = 'es') => {
    const value = prompt.value.trim().slice(0, maxPromptLength);
    if (!value || loading.value) return;
    lastPrompt.value = value;
    prompt.value = '';

    const timeout = setTimeout(() => abort(), timeoutMs);
    try {
      await sendPrompt(value, context, { locale });
    } finally {
      clearTimeout(timeout);
    }
  };

  const retryLast = async (context: AiPlantContext | null, locale = 'es') => {
    if (!lastPrompt.value || loading.value) return;
    await store.retry(lastPrompt.value, context, locale);
  };

  return {
    messages: readonly(messages),
    loading: readonly(loading),
    streaming: readonly(streaming),
    error: readonly(error),
    prompt,
    canSend,
    send,
    abort,
    retryLast,
    startNewConversation,
  };
}

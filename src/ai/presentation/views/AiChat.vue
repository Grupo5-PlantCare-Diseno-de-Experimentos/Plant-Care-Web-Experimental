<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import InputText from 'primevue/inputtext';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useAiStore } from '../../application/ai.store';
import { useAiChat } from '../composables/useAiChat';
import { AiAssembler } from '../../infrastructure/ai-assembler';
import { buildDiagnosis } from '../../infrastructure/ai-diagnosis';
import { usePlantManagementStore } from '../../../plants/application/plants.store';
import { useAuthStore } from '../../../auth/store/authStore';
import AiMessageList from '../components/AiMessageList.vue';
import AiPromptForm from '../components/AiPromptForm.vue';
import AiDiagnosisCard from '../components/AiDiagnosisCard.vue';

const { t, locale } = useI18n();
const aiStore = useAiStore();
const plantStore = usePlantManagementStore();
const authStore = useAuthStore();
const chat = useAiChat();
const confirm = useConfirm();
const toast = useToast();
const { explanation, explanationLoading, explanationError } = storeToRefs(aiStore);

const selectedPlantId = ref<number | null>(null);

// Historial: buscar + renombrar (estado local, skill vue-best-practices).
const searchQuery = ref('');
const editingId = ref<string | null>(null);
const draftTitle = ref('');

// Hilo flotante: scroll propio + botón volver-abajo.
const threadRef = ref<HTMLElement | null>(null);
const showJumpToBottom = ref(false);

const filteredConversations = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return aiStore.conversations;
  return aiStore.conversations.filter((c) => c.title.toLowerCase().includes(q));
});

const selectedPlant = computed(
  () =>
    plantStore.plants.find((p) => p.id === selectedPlantId.value) ??
    plantStore.plants[0] ??
    null
);

const diagnosis = computed(() =>
  selectedPlant.value ? buildDiagnosis(selectedPlant.value) : null
);

const aiContext = computed(() =>
  AiAssembler.buildPromptContext({
    plants: plantStore.plants.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      lastWatered: p.lastWatered,
      nextWatering: p.nextWatering,
    })),
  })
);

const handleSubmit = async () => {
  // El error ya queda en el store (chat.error) y la vista lo muestra;
  // se captura aquí para no dejar promesas sin manejar (Vue warn).
  try {
    await chat.send(aiContext.value, locale.value);
    await aiStore.loadConversations();
    await scrollToBottom(true);
  } catch {
    /* noop: error visible en la vista */
  }
};

const handleSelectConversation = async (conversationId: string) => {
  aiStore.clearExplanation();
  await aiStore.loadMessages(conversationId);
};

const handleNewConversation = () => {
  aiStore.startNewConversation();
  aiStore.clearExplanation();
};

const askDeleteConversation = (conversationId: string, title: string) => {
  confirm.require({
    message: t('ai.history.deleteConfirmMessage', { title }),
    header: t('ai.history.deleteConfirmTitle'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('ai.history.deleteConfirmYes'),
    rejectLabel: t('ai.history.deleteConfirmNo'),
    accept: async () => {
      try {
        await aiStore.deleteConversation(conversationId);
        if (editingId.value === conversationId) cancelRename();
        toast.add({ severity: 'success', summary: t('ai.history.deletedOk'), life: 3000 });
      } catch {
        toast.add({ severity: 'error', summary: t('ai.history.deleteError'), life: 3000 });
      }
    },
  });
};

const startRename = (conversationId: string, title: string) => {
  editingId.value = conversationId;
  draftTitle.value = title;
};

const cancelRename = () => {
  editingId.value = null;
  draftTitle.value = '';
};

const saveRename = async () => {
  if (!editingId.value) return;
  const trimmed = draftTitle.value.trim();
  if (!trimmed) {
    toast.add({ severity: 'warn', summary: t('ai.history.renameEmpty'), life: 3000 });
    return;
  }
  try {
    await aiStore.renameConversation(editingId.value, trimmed);
    toast.add({ severity: 'success', summary: t('ai.history.renamedOk'), life: 3000 });
    cancelRename();
  } catch {
    toast.add({ severity: 'error', summary: t('ai.history.deleteError'), life: 3000 });
  }
};

const isNearBottom = (): boolean => {
  const el = threadRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
};

const scrollToBottom = async (force = false) => {
  await nextTick();
  const el = threadRef.value;
  if (!el) return;
  if (force || isNearBottom()) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }
};

const onThreadScroll = () => {
  showJumpToBottom.value = !isNearBottom();
};

const jumpToBottom = async () => {
  await scrollToBottom(true);
};

onMounted(async () => {
  if (authStore.userId) {
    await plantStore.fetchPlants(authStore.userId);
  }
  if (plantStore.plants[0] && selectedPlantId.value === null) {
    selectedPlantId.value = plantStore.plants[0].id;
  }
  await aiStore.loadConversations();
});

watch(
  () => plantStore.plants[0]?.id,
  (firstId) => {
    if (selectedPlantId.value === null && firstId !== undefined) {
      selectedPlantId.value = firstId;
    }
  }
);

// Auto-scroll del hilo flotante al llegar mensajes/streaming.
watch(
  () => [chat.messages.value.length, chat.streaming.value] as const,
  async () => {
    await scrollToBottom();
  }
);

const handleExplain = async () => {
  if (!diagnosis.value) return;
  await aiStore.requestExplanation(diagnosis.value, aiContext.value, locale.value);
};

const handleRetry = async () => {
  // Igual que handleSubmit: el error vive en el store, aquí solo se
  // evita la promesa sin manejar.
  try {
    await chat.retryLast(aiContext.value, locale.value);
  } catch {
    /* noop: error visible en la vista */
  }
};
</script>

<template>
  <div class="ai-chat" data-testid="ai-chat-view">
    <ConfirmDialog />
    <header class="ai-hero">
      <div class="ai-hero-icon" aria-hidden="true">
        <i class="pi pi-sparkles"></i>
      </div>
      <div class="ai-hero-copy">
        <p class="ai-eyebrow"><span class="ai-eyebrow-dot"></span>PlantCare IA</p>
        <h1 class="ai-title">{{ t('ai.title') }}</h1>
        <p class="ai-subtitle">{{ t('ai.subtitle') }}</p>
      </div>
    </header>

    <div v-if="chat.error.value" class="ai-error" data-testid="ai-error">
      <i class="pi pi-exclamation-triangle ai-error-icon" aria-hidden="true"></i>
      <span class="ai-error-text">{{ chat.error.value }}</span>
      <Button
        label="Reintentar"
        severity="secondary"
        size="small"
        @click="handleRetry"
      />
    </div>

    <div class="ai-layout">
      <aside class="ai-sidebar glass">
        <section class="ai-history" data-testid="ai-conversation-list">
          <div class="ai-history-header">
            <h2>{{ t('ai.history.title') }}</h2>
            <Button
              :label="t('ai.history.new')"
              data-testid="ai-new-conversation"
              severity="secondary"
              size="small"
              icon="pi pi-plus"
              @click="handleNewConversation"
            />
          </div>
          <div class="ai-search-wrap">
            <i class="pi pi-search ai-search-icon" aria-hidden="true"></i>
            <InputText
              v-model="searchQuery"
              class="ai-search"
              data-testid="ai-conversation-search"
              :placeholder="t('ai.history.searchPlaceholder')"
            />
          </div>
          <p v-if="aiStore.conversations.length === 0" class="ai-history-empty">
            {{ t('ai.history.empty') }}
          </p>
          <p
            v-else-if="filteredConversations.length === 0"
            class="ai-history-empty"
            data-testid="ai-conversation-no-results"
          >
            {{ t('ai.history.noResults', { query: searchQuery.trim() }) }}
          </p>
          <TransitionGroup v-else name="ai-history" tag="ul" class="ai-history-items">
            <li v-for="conv in filteredConversations" :key="conv.id">
              <div
                class="ai-history-item"
                :class="{ active: conv.id === aiStore.activeConversationId }"
              >
                <button
                  type="button"
                  class="ai-history-select"
                  data-testid="ai-conversation-item"
                  @click="handleSelectConversation(conv.id)"
                >
                  <span class="ai-history-dot" aria-hidden="true"></span>
                  <span class="ai-history-meta">
                    <span class="ai-history-title">{{ conv.title }}</span>
                    <span class="ai-history-date">{{
                      new Date(conv.createdAt).toLocaleDateString(locale)
                    }}</span>
                  </span>
                </button>
                <div v-if="editingId === conv.id" class="ai-rename">
                  <InputText
                    v-model="draftTitle"
                    class="ai-rename-input"
                    data-testid="ai-conversation-rename-input"
                    maxlength="120"
                    @keyup.enter="saveRename"
                    @keyup.escape="cancelRename"
                  />
                  <Button
                    icon="pi pi-check"
                    data-testid="ai-conversation-rename-save"
                    size="small"
                    :aria-label="t('ai.history.renameSave')"
                    @click="saveRename"
                  />
                  <Button
                    icon="pi pi-times"
                    severity="secondary"
                    size="small"
                    :aria-label="t('ai.history.renameCancel')"
                    @click="cancelRename"
                  />
                </div>
                <div v-else class="ai-history-actions">
                  <Button
                    icon="pi pi-pencil"
                    text
                    size="small"
                    data-testid="ai-conversation-rename"
                    :aria-label="t('ai.history.renameLabel')"
                    @click="startRename(conv.id, conv.title)"
                  />
                  <Button
                    icon="pi pi-trash"
                    text
                    severity="danger"
                    size="small"
                    data-testid="ai-conversation-delete"
                    :aria-label="t('ai.history.deleteLabel')"
                    @click="askDeleteConversation(conv.id, conv.title)"
                  />
                </div>
              </div>
            </li>
          </TransitionGroup>
        </section>

        <div class="ai-plant-picker">
          <label for="ai-plant">{{ t('ai.diagnosis.plantLabel') }}</label>
          <div class="ai-select-wrap">
            <i class="pi pi-leaf ai-select-icon" aria-hidden="true"></i>
            <select
              id="ai-plant"
              v-model="selectedPlantId"
              class="ai-select"
              data-testid="ai-plant-select"
            >
              <option
                v-for="plant in plantStore.plants"
                :key="plant.id"
                :value="plant.id"
              >
                {{ plant.name }}
              </option>
            </select>
            <i class="pi pi-chevron-down ai-select-caret" aria-hidden="true"></i>
          </div>
        </div>
      </aside>

      <main class="ai-main">
        <AiDiagnosisCard
          :diagnosis="diagnosis"
          :explanation="explanation"
          :explanation-loading="explanationLoading"
          :explanation-error="explanationError"
          @explain="handleExplain"
          @clear="aiStore.clearExplanation()"
        />

        <div class="ai-thread glass">
          <div ref="threadRef" class="ai-thread-scroll" @scroll="onThreadScroll">
            <AiMessageList :messages="chat.messages.value" :streaming="chat.streaming.value">
              <template #empty>
                <div class="ai-thread-empty">
                  <span class="ai-thread-empty-icon" aria-hidden="true">🌱</span>
                  <p>{{ t('ai.empty') }}</p>
                </div>
              </template>
            </AiMessageList>
          </div>

          <Transition name="ai-jump">
            <Button
              v-if="showJumpToBottom"
              icon="pi pi-arrow-down"
              :label="t('ai.thread.backToBottom')"
              data-testid="ai-back-to-bottom"
              size="small"
              class="ai-jump"
              @click="jumpToBottom"
            />
          </Transition>

          <div class="ai-composer">
            <AiPromptForm
              v-model="chat.prompt.value"
              :loading="chat.loading.value"
              @submit="handleSubmit"
              @abort="chat.abort()"
            />
            <p class="ai-hint"><i class="pi pi-info-circle" aria-hidden="true"></i> {{ t('ai.hint') }}</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.75rem clamp(1rem, 3vw, 2rem) 2.5rem;
  color: var(--text-primary);
}

/* Hero premium */
.ai-hero {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.ai-hero-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--gradient-primary);
  color: #fff;
  font-size: 1.35rem;
  box-shadow: var(--shadow-green);
}
.ai-hero-copy {
  min-width: 0;
}
.ai-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.35rem;
  padding: 0.25rem 0.7rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
}
.ai-eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-green);
  box-shadow: 0 0 0 4px var(--primary-green-light);
}
.ai-title {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.3rem);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: -0.03em;
  line-height: 1.05;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.ai-subtitle {
  margin: 0.4rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  max-width: 60ch;
}

/* Error banner — tokens, respeta dark */
.ai-error {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-lg);
  background: var(--surface-danger-soft);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  animation: fadeIn 0.4s ease both;
}
.ai-error-icon {
  color: var(--status-critical);
}
.ai-error-text {
  flex: 1;
  font-size: var(--font-size-sm);
}

/* Layout 2 columnas */
.ai-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}
.ai-sidebar {
  border-radius: var(--radius-xl);
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1rem;
}
.ai-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}
.ai-thread {
  position: relative;
  border-radius: var(--radius-xl);
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
}
.ai-thread-scroll {
  padding: clamp(1rem, 2vw, 1.5rem);
  overflow-y: auto;
  max-height: min(68vh, 720px);
  min-height: 320px;
  scroll-behavior: smooth;
}
.ai-thread-empty {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-secondary);
}
.ai-thread-empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
  filter: saturate(1.2);
}
.ai-thread-empty p {
  margin: 0 auto;
  max-width: 38ch;
  font-size: var(--font-size-sm);
}
.ai-composer {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem clamp(1rem, 2vw, 1.5rem) 1rem;
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-top: 1px solid var(--border-color);
}
.ai-jump {
  position: absolute;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
  z-index: 5;
}
.ai-jump-enter-active,
.ai-jump-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.ai-jump-enter-from,
.ai-jump-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
.ai-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* Historial */
.ai-history {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.ai-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.ai-history-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.ai-history-empty {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  background: var(--surface-muted);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.8rem;
  text-align: center;
}
.ai-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ai-search-icon {
  position: absolute;
  left: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  pointer-events: none;
}
.ai-search {
  width: 100%;
  padding-left: 2.2rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
}
.ai-history-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 320px;
  overflow-y: auto;
}
.ai-history-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.ai-history-item:hover {
  background: var(--surface-muted);
  border-color: var(--border-color);
}
.ai-history-item.active {
  background: var(--bg-card);
  border-color: var(--primary-green);
  box-shadow: var(--shadow-sm);
}
.ai-history-select {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.25rem 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.ai-history-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.ai-history-item:hover .ai-history-actions,
.ai-history-item:focus-within .ai-history-actions {
  opacity: 1;
}
.ai-rename {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.ai-rename-input {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  padding: 0.35rem 0.6rem;
}
/* Animación de lista al borrar/filtrar */
.ai-history-enter-active,
.ai-history-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.ai-history-enter-from,
.ai-history-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
.ai-history-move {
  transition: transform 0.25s ease;
}
.ai-history-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-tertiary);
}
.ai-history-item.active .ai-history-dot {
  background: var(--primary-green);
  box-shadow: 0 0 0 3px var(--primary-green-light);
}
.ai-history-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.ai-history-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-history-date {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}
.ai-history-arrow {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

/* Plant picker */
.ai-plant-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}
.ai-plant-picker label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.ai-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ai-select {
  flex: 1;
  width: 100%;
  appearance: none;
  padding: 0.65rem 2.2rem 0.65rem 2.3rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.ai-select:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: 0 0 0 3px var(--primary-green-light);
}
.ai-select-icon {
  position: absolute;
  left: 0.8rem;
  color: var(--primary-green);
  pointer-events: none;
}
.ai-select-caret {
  position: absolute;
  right: 0.8rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  pointer-events: none;
}

@media (max-width: 1024px) {
  .ai-layout {
    grid-template-columns: 1fr;
  }
  .ai-sidebar {
    position: static;
  }
  .ai-history-items {
    max-height: 200px;
  }
  .ai-history-actions {
    opacity: 1;
  }
  .ai-thread-scroll {
    max-height: 60vh;
    min-height: 280px;
  }
}
</style>

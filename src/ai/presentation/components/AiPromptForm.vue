<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

const prompt = defineModel<string>({ default: '' });

defineProps<{
  loading: boolean;
}>();

defineEmits<{
  submit: [];
  abort: [];
}>();
</script>

<template>
  <form class="ai-prompt-form glass" data-testid="ai-prompt-form" @submit.prevent="$emit('submit')">
    <i class="pi pi-sparkles ai-prompt-spark" aria-hidden="true"></i>
    <InputText
      v-model="prompt"
      class="ai-input"
      data-testid="ai-prompt-input"
      :placeholder="'Haz una pregunta sobre tus plantas…'"
      :disabled="loading"
    />
    <Button
      type="submit"
      label="Enviar"
      icon="pi pi-send"
      data-testid="ai-prompt-submit"
      class="ai-send"
      :loading="loading"
      :disabled="prompt.trim().length === 0 || loading"
    />
    <Button
      v-if="loading"
      type="button"
      label="Cancelar"
      icon="pi pi-stop"
      data-testid="ai-prompt-cancel"
      severity="secondary"
      size="small"
      class="ai-cancel"
      @click="$emit('abort')"
    />
  </form>
</template>

<style scoped>
.ai-prompt-form {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
}
.ai-prompt-form:focus-within {
  border-color: var(--primary-green);
  box-shadow: 0 0 0 3px var(--primary-green-light), var(--shadow-md);
}
.ai-prompt-spark {
  color: var(--primary-green);
  font-size: 0.95rem;
  flex-shrink: 0;
}
.ai-input {
  flex: 1;
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 0.55rem 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  min-width: 0;
}
.ai-input:focus {
  box-shadow: none;
  border: none;
  outline: none;
}
.ai-input::placeholder {
  color: var(--text-tertiary);
}
.ai-send {
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--gradient-primary);
  border: none;
  box-shadow: var(--shadow-green);
}
/* Oculta el label visualmente pero lo conserva para tests/a11y */
.ai-send :deep(.p-button-label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.ai-cancel :deep(.p-button-label) {
  font-size: var(--font-size-xs);
}
.ai-cancel {
  flex-shrink: 0;
  border-radius: var(--radius-full);
}
@media (max-width: 640px) {
  .ai-prompt-form {
    border-radius: var(--radius-xl);
  }
}
</style>

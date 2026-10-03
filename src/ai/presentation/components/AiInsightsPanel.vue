<script setup lang="ts">
import Button from 'primevue/button';
import type { AiInsightInput } from '../../domain/model/ai.entity.ts';
import { renderSafeMarkdown } from '../../infrastructure/ai-markdown';

defineProps<{
  input: AiInsightInput | null;
  insights: string | null;
  loading: boolean;
  error: string | null;
}>();

defineEmits<{
  generate: [];
  clear: [];
}>();
</script>

<template>
  <div class="ai-insights glass" data-testid="ai-insights-panel">
    <div class="ai-insights-header">
      <div class="ai-insights-copy">
        <p class="ai-insights-eyebrow"><span class="ai-insights-dot"></span>{{ $t('ai.insights.eyebrow') }}</p>
        <h3 class="ai-insights-title">{{ $t('ai.insights.title') }}</h3>
        <p class="ai-insights-sub">{{ $t('ai.insights.subtitle') }}</p>
      </div>
      <Button
        :label="$t('ai.insights.generate')"
        data-testid="ai-insights-generate"
        icon="pi pi-sparkles"
        class="ai-insights-generate"
        :loading="loading"
        :disabled="loading || !input"
        @click="$emit('generate')"
      />
    </div>

    <div
      v-if="insights"
      class="ai-insights-text"
      data-testid="ai-insights-text"
      v-html="renderSafeMarkdown(insights)"
    ></div>
    <p v-else-if="error" class="ai-insights-fallback">
      <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
      <span>{{ error }} — {{ $t('ai.insights.fallback', { anomalies: (input?.anomalies.join(', ') || '—') }) }}</span>
    </p>
    <p v-else class="ai-insights-hint">
      <i class="pi pi-lightbulb" aria-hidden="true"></i>
      <span>{{ $t('ai.insights.hint') }}</span>
    </p>

    <Button
      v-if="insights || error"
      :label="$t('ai.insights.clear')"
      icon="pi pi-times"
      data-testid="ai-insights-clear"
      severity="secondary"
      size="small"
      class="ai-insights-clear"
      @click="$emit('clear')"
    />
  </div>
</template>

<style scoped>
.ai-insights {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.25rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
}
.ai-insights-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.ai-insights-copy {
  min-width: 0;
}
.ai-insights-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.4rem;
  padding: 0.2rem 0.65rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
}
.ai-insights-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-green);
  box-shadow: 0 0 0 3px var(--primary-green-light);
}
.ai-insights-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}
.ai-insights-sub {
  margin: 0.25rem 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
.ai-insights-generate {
  flex-shrink: 0;
  background: var(--gradient-primary);
  border: none;
  box-shadow: var(--shadow-green);
}
.ai-insights-text {
  margin: 0;
  white-space: pre-wrap;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  background: var(--surface-success-soft);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.85rem;
  color: var(--text-primary);
}
.ai-insights-fallback {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.75rem 0.85rem;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--surface-danger-soft);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.ai-insights-fallback i {
  color: var(--status-critical);
  margin-top: 0.15rem;
}
.ai-insights-hint {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.75rem 0.85rem;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  background: var(--surface-muted);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}
.ai-insights-hint i {
  color: var(--primary-green);
  margin-top: 0.15rem;
}
.ai-insights-clear {
  align-self: flex-start;
  border-radius: var(--radius-full);
}
@media (max-width: 640px) {
  .ai-insights-header {
    flex-direction: column;
  }
}
</style>

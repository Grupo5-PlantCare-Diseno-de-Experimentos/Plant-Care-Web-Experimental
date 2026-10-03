<script setup lang="ts">
import Button from 'primevue/button';
import type { AiDiagnosis } from '../../domain/model/ai.entity.ts';
import { renderSafeMarkdown } from '../../infrastructure/ai-markdown';

defineProps<{
  diagnosis: AiDiagnosis | null;
  explanation: string | null;
  explanationLoading: boolean;
  explanationError: string | null;
}>();

defineEmits<{
  explain: [];
  clear: [];
}>();
</script>

<template>
  <div v-if="diagnosis" class="ai-diagnosis glass" data-testid="ai-diagnosis-card">
    <div class="ai-diagnosis-header">
      <div class="ai-plant">
        <span class="ai-plant-avatar" aria-hidden="true">🌿</span>
        <div class="ai-plant-meta">
          <strong class="ai-plant-name">{{ diagnosis.plantName }}</strong>
          <span class="ai-status" :class="`ai-status-${diagnosis.status}`">
            <span class="ai-status-dot"></span>{{ diagnosis.status }}
          </span>
        </div>
      </div>
      <div class="ai-score-ring" :style="`--score: ${diagnosis.score}`" role="img" :aria-label="`${diagnosis.score}/100`">
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle class="ai-ring-track" cx="22" cy="22" r="18" />
          <circle class="ai-ring-fill" cx="22" cy="22" r="18" />
        </svg>
        <span class="ai-score-value">{{ diagnosis.score }}</span>
      </div>
    </div>

    <div class="ai-score-bar" aria-hidden="true">
      <span class="ai-score-fill" :style="`width: ${diagnosis.score}%`"></span>
    </div>

    <ul class="ai-details">
      <li v-for="detail in diagnosis.details" :key="detail">
        <i class="pi pi-check-circle" aria-hidden="true"></i><span>{{ detail }}</span>
      </li>
    </ul>
    <p class="ai-watering"><i class="pi pi-tint" aria-hidden="true"></i> {{ diagnosis.wateringReason }}</p>

    <div class="ai-actions">
      <Button
        label="Explicar con IA"
        icon="pi pi-sparkles"
        data-testid="ai-explain-btn"
        :loading="explanationLoading"
        :disabled="explanationLoading"
        @click="$emit('explain')"
      />
      <Button
        v-if="explanation || explanationError"
        label="Limpiar"
        icon="pi pi-times"
        data-testid="ai-explanation-clear"
        severity="secondary"
        @click="$emit('clear')"
      />
    </div>

    <div
      v-if="explanation"
      class="ai-explanation"
      data-testid="ai-explanation"
      v-html="renderSafeMarkdown(explanation)"
    ></div>
    <p v-else-if="explanationError" class="ai-fallback">
      <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
      {{ explanationError }} — Se muestra el diagnóstico determinista.
    </p>
  </div>
</template>

<style scoped>
.ai-diagnosis {
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: var(--shadow-md);
  animation: scaleUp 0.4s ease both;
}
.ai-diagnosis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.ai-plant {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}
.ai-plant-avatar {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  border-radius: var(--radius-lg);
  background: var(--surface-success-soft);
  border: 1px solid var(--border-color);
}
.ai-plant-meta {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.ai-plant-name {
  font-size: var(--font-size-lg);
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  padding: 0.15rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  border: 1px solid var(--border-color);
}
.ai-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.ai-status-healthy {
  background: var(--surface-success-soft);
  color: var(--status-success);
}
.ai-status-warning {
  background: var(--surface-warning-soft);
  color: var(--status-warning);
}
.ai-status-critical {
  background: var(--surface-danger-soft);
  color: var(--status-critical);
}
/* Anillo de score */
.ai-score-ring {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}
.ai-score-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ai-ring-track {
  fill: none;
  stroke: var(--surface-muted);
  stroke-width: 5;
}
.ai-ring-fill {
  fill: none;
  stroke: url(#aiScoreGradient);
  stroke: var(--primary-green);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 113;
  stroke-dashoffset: calc(113 - (113 * var(--score)) / 100);
  transition: stroke-dashoffset 0.6s ease;
}
.ai-score-value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}
.ai-score-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--surface-muted);
  overflow: hidden;
}
.ai-score-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-primary);
  transition: width 0.6s ease;
}
.ai-details {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.ai-details li {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}
.ai-details i {
  color: var(--primary-green);
  margin-top: 0.15rem;
  font-size: 0.85rem;
}
.ai-watering {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.7rem 0.85rem;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--surface-info-soft);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.ai-watering i {
  color: var(--status-info);
  margin-top: 0.15rem;
}
.ai-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ai-explanation {
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
.ai-fallback {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.7rem 0.85rem;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--surface-danger-soft);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.ai-fallback i {
  color: var(--status-critical);
  margin-top: 0.15rem;
}
</style>

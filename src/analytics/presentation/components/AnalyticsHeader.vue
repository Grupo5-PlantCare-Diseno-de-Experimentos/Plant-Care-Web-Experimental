<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="an-header">
    <div>
      <p class="an-eyebrow">{{ t('analytics.header.eyebrow') }}</p>
      <h1 class="an-title">{{ t('analytics.header.title') }}</h1>
      <p class="an-subtitle">{{ t('analytics.header.subtitle') }}</p>
    </div>
    <span class="an-badge">{{ t('analytics.badge.last30Days') }}</span>
  </div>
</template>

<style scoped>
.an-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.an-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--primary-green);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  margin: 0 0 0.25rem;
}

.an-title {
  margin: 0 0 0.25rem;
  color: var(--text-primary);
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.an-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
}

.an-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.38rem 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
  background: var(--surface-success-soft);
  color: var(--status-success);
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  margin-top: 0.4rem;
}

@media (max-width: 768px) {
  .an-header {
    flex-direction: column;
  }
}
</style>

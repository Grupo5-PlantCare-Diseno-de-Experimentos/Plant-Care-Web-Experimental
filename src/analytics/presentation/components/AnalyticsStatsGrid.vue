<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  totalPlants: number;
  healthyPlants: number;
  healthDistribution: { healthy: number; warning: number; critical: number };
  summary: { avgHumidity: number; avgSoilMoisture: number; totalReadings: number; };
  plantsNeedingAttention: number;
}>()
</script>

<template>
  <div class="an-stats-grid">
    <div class="glass-card an-stat-card">
      <div class="an-stat-icon-wrap is-success">
        <i class="pi pi-leaf"></i>
      </div>
      <div>
        <p class="an-stat-label">{{ t('analytics.stats.totalPlants') }}</p>
        <p class="an-stat-val">{{ totalPlants }}</p>
        <p class="an-stat-trend positive">{{ t('analytics.stats.trendMonth') }}</p>
      </div>
    </div>

    <div class="glass-card an-stat-card">
      <div class="an-stat-icon-wrap is-info">
        <i class="pi pi-heart"></i>
      </div>
      <div>
        <p class="an-stat-label">{{ t('analytics.stats.healthyPlants') }}</p>
        <p class="an-stat-val">{{ healthyPlants }}</p>
        <p class="an-stat-trend positive">{{ t('analytics.stats.healthRate', { rate: healthDistribution.healthy }) }}</p>
      </div>
    </div>

    <div class="glass-card an-stat-card">
      <div class="an-stat-icon-wrap is-info">
        <i class="pi pi-cloud"></i>
      </div>
      <div>
        <p class="an-stat-label">{{ t('analytics.stats.avgHumidity') }}</p>
        <p class="an-stat-val">{{ summary.avgHumidity }}%</p>
        <p class="an-stat-trend positive">{{ t('analytics.stats.ambientLevel') }}</p>
      </div>
    </div>

    <div class="glass-card an-stat-card">
      <div class="an-stat-icon-wrap is-success">
        <i class="pi pi-ticket"></i>
      </div>
      <div>
        <p class="an-stat-label">{{ t('analytics.stats.avgSoilMoisture') }}</p>
        <p class="an-stat-val">{{ summary.avgSoilMoisture }}%</p>
        <p class="an-stat-trend positive">{{ t('analytics.stats.readings', { count: summary.totalReadings }) }}</p>
      </div>
    </div>

    <div class="glass-card an-stat-card">
      <div class="an-stat-icon-wrap is-warning">
        <i class="pi pi-exclamation-triangle"></i>
      </div>
      <div>
        <p class="an-stat-label">{{ t('analytics.stats.needAttention') }}</p>
        <p class="an-stat-val">{{ plantsNeedingAttention }}</p>
        <p class="an-stat-trend negative">{{ t('analytics.stats.vsYesterday') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.an-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.9rem;
}

.an-stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.4rem;
  transition: transform 0.18s;
}

.an-stat-card:hover {
  transform: translateY(-2px);
}

.an-stat-icon-wrap {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.an-stat-icon-wrap.is-success {
  background: var(--surface-success-soft);
  color: var(--status-success);
}

.an-stat-icon-wrap.is-info {
  background: var(--surface-info-soft);
  color: var(--status-info);
}

.an-stat-icon-wrap.is-warning {
  background: var(--surface-warning-soft);
  color: var(--status-warning);
}

.an-stat-label {
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  margin: 0;
}

.an-stat-val {
  font-size: 1.7rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  color: var(--text-primary);
  margin: 0.2rem 0;
}

.an-stat-trend {
  font-size: 0.78rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  margin: 0;
}

.an-stat-trend.positive {
  color: var(--status-success);
}

.an-stat-trend.negative {
  color: var(--status-critical);
}

@media (max-width: 768px) {
  .an-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .an-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

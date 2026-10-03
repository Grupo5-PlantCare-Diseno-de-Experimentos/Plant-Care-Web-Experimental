<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../../auth/store/authStore'
import { useAnalyticsStore } from '../../application/analytics.store'
import { usePlantManagementStore } from '../../../plants/application/plants.store'
import type { Analytics } from '../../domain/model/analytics.entity'
import type { Plant } from '../../../plants/domain/model/plants.entity'
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import AnalyticsHeader from '../components/AnalyticsHeader.vue'
import AnalyticsStatsGrid from '../components/AnalyticsStatsGrid.vue'
import MetricAreaChart from '../components/MetricAreaChart.vue'
import PremiumPromo from '../../../experiments/premium/PremiumPromo.vue'
import AiInsightsPanel from '../../../ai/presentation/components/AiInsightsPanel.vue'
import { useAiStore } from '../../../ai/application/ai.store'
import { buildInsightsInput } from '../../../ai/infrastructure/ai-insights'
import { storeToRefs } from 'pinia'

// interface Summary {
//   avgTemperature: number
//   avgHumidity: number
//   avgSoilMoisture: number
//   avgLight: number
//   totalReadings: number
// }

const authStore = useAuthStore()
const { t, locale } = useI18n()
const analyticsStore = useAnalyticsStore()
const plantsStore = usePlantManagementStore()
const aiStore = useAiStore()
const { insights, insightsLoading, insightsError } = storeToRefs(aiStore)

// Component state
const loading = ref(false)
const loadingHistory = ref(false)
const error = ref<string | null>(null)

// Getters from stores
const analytics = computed(() => analyticsStore.analytics)
const plants = computed(() => plantsStore.plants)
const historicalData = computed(() => analyticsStore.historicalAverages)
const hasAnalytics = computed(() => analyticsStore.hasAnalytics)
const hasHistoricalData = computed(() => analyticsStore.hasHistoricalData)
// Plant statistics
const totalPlants = computed(() => plants.value.length)
const healthyPlants = computed(() => plants.value.filter((p: Plant) => p.status === 'healthy').length)
const warningCount = computed(() => plants.value.filter((p: Plant) => p.status === 'warning').length)
const criticalCount = computed(() => plants.value.filter((p: Plant) => p.status === 'critical').length)
const plantsNeedingAttention = computed(() => warningCount.value + criticalCount.value)

const healthDistribution = computed(() => {
  const total = plants.value.length || 1
  return {
    healthy: Math.round((healthyPlants.value / total) * 100),
    warning: Math.round((warningCount.value / total) * 100),
    critical: Math.round((criticalCount.value / total) * 100)
  }
})

// Chart data from store getters
const temperatureData = computed(() => analyticsStore.temperatureChartData)
const humidityData = computed(() => analyticsStore.humidityChartData)


// Summary data
const summary = computed(() => {
  if (!analytics.value.length) return {
    avgTemperature: 0,
    avgHumidity: 0,
    avgSoilMoisture: 0,
    avgLight: 0,
    totalReadings: 0
  }
  
  const totalAnalytics = analytics.value.length
  const totals = analytics.value.reduce((acc: { 
    avgTemperature: number; 
    avgHumidity: number; 
    avgSoilMoisture: number; 
    avgLight: number; 
    totalReadings: number 
  }, item: Analytics) => ({
    avgTemperature: acc.avgTemperature + item.summary.avgTemperature,
    avgHumidity: acc.avgHumidity + item.summary.avgHumidity,
    avgSoilMoisture: acc.avgSoilMoisture + item.summary.avgSoilMoisture,
    avgLight: acc.avgLight + item.summary.avgLight,
    totalReadings: acc.totalReadings + item.summary.totalReadings
  }), { avgTemperature: 0, avgHumidity: 0, avgSoilMoisture: 0, avgLight: 0, totalReadings: 0 })

  return {
    avgTemperature: Math.round(totals.avgTemperature / totalAnalytics),
    avgHumidity: Math.round(totals.avgHumidity / totalAnalytics),
    avgSoilMoisture: Math.round(totals.avgSoilMoisture / totalAnalytics),
    avgLight: Math.round(totals.avgLight / totalAnalytics),
    totalReadings: totals.totalReadings
  }
})

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    await analyticsStore.initializeAnalytics()
  } catch (err: any) {
    if (err.message === 'NOT_AUTHENTICATED') {
      error.value = t('errors.notAuthenticatedLogin')
    } else {
      error.value = err.response?.data?.message || err.message || t('errors.analyticsLoad')
    }
  } finally {
    loading.value = false
  }
}

const loadHistoricalData = async () => {
  loadingHistory.value = true
  try {
    await analyticsStore.fetchHistoricalAverages(5)
  } catch (err: any) {
    console.error('[Analytics] Error calculating historical data:', err)
  } finally {
    loadingHistory.value = false
  }
}

const dayLabels = computed(() => [
  t('analytics.days.mon'),
  t('analytics.days.tue'),
  t('analytics.days.wed'),
  t('analytics.days.thu'),
  t('analytics.days.fri'),
  t('analytics.days.sat'),
  t('analytics.days.sun')
])

const insightsInput = computed(() =>
  buildInsightsInput(
    {
      avgTemperature: summary.value.avgTemperature,
      avgHumidity: summary.value.avgHumidity,
      avgSoilMoisture: summary.value.avgSoilMoisture,
      avgLight: summary.value.avgLight,
      totalReadings: summary.value.totalReadings,
    },
    {
      totalPlants: totalPlants.value,
      plantsNeedingAttention: plantsNeedingAttention.value,
    }
  )
)

const handleGenerateInsights = async () => {
  if (!insightsInput.value) return;
  await aiStore.requestInsights(insightsInput.value, locale.value);
}

onMounted(async () => {
  await authStore.initialize()
  await new Promise(resolve => setTimeout(resolve, 100))
  await loadData()
  await loadHistoricalData()
})
</script>

<template>
  <div class="an-wrap">
    <!-- Header -->
    <AnalyticsHeader />

    <!-- Loading -->
    <div v-if="loading" class="an-loading glass-card">
      <div class="an-loading-core">
        <i class="pi pi-spin pi-spinner an-loading-icon"></i>
      </div>
      <h2>{{ t('analytics.loading') }}</h2>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="an-fullstate glass-card">
      <div class="an-state-icon is-danger">
        <i class="pi pi-exclamation-circle"></i>
      </div>
      <h3 class="an-state-title">{{ t('analytics.error.title') }}</h3>
      <p class="an-state-sub">{{ error }}</p>
      <button class="an-retry-btn" @click="loadData">
        <i class="pi pi-refresh"></i> {{ t('analytics.error.retry') }}
      </button>
    </div>

    <!-- Empty: no plants -->
    <div v-else-if="totalPlants === 0 && !loading" class="an-fullstate glass-card">
      <div class="an-state-icon is-info">
        <i class="pi pi-plus-circle"></i>
      </div>
      <h3 class="an-state-title">{{ t('analytics.empty.noPlants.title') }}</h3>
      <p class="an-state-sub">{{ t('analytics.empty.noPlants.subtitle') }}</p>
      <router-link to="/plants/new">
        <Button :label="t('analytics.empty.noPlants.cta')" icon="pi pi-plus" class="an-cta-btn" />
      </router-link>
    </div>

    <!-- Empty: no metrics -->
    <div v-else-if="!hasAnalytics && !loading" class="an-fullstate glass-card">
      <div class="an-state-icon is-success">
        <i class="pi pi-chart-line"></i>
      </div>
      <h3 class="an-state-title">{{ t('analytics.empty.noData.title') }}</h3>
      <p class="an-state-sub">{{ t('analytics.empty.noData.subtitle') }}</p>
      <p class="an-state-hint">{{ t('analytics.empty.noData.hint') }}</p>
    </div>

    <!-- Main content -->
    <template v-else>

      <!-- Stats grid -->
      <AnalyticsStatsGrid 
        :totalPlants="totalPlants"
        :healthyPlants="healthyPlants"
        :healthDistribution="healthDistribution"
        :summary="summary"
        :plantsNeedingAttention="plantsNeedingAttention"
      />

      <!-- AI insights (Fase 3) -->
      <AiInsightsPanel
        :input="insightsInput"
        :insights="insights"
        :loading="insightsLoading"
        :error="insightsError"
        @generate="handleGenerateInsights"
        @clear="aiStore.clearInsights()"
      />

      <!-- Charts grid -->
      <div class="an-charts-grid">

        <!-- Temperature -->
        <MetricAreaChart 
          :title="t('analytics.charts.temperatureTitle')"
          :subtitle="t('analytics.charts.temperatureSub')"
          :sectionLabel="t('analytics.section.sensor')"
          color="var(--status-warning)"
          gradientId="tempGrad"
          :data="temperatureData"
          :dayLabels="dayLabels"
          :useMaxScale="true"
        />

        <!-- Humidity -->
        <MetricAreaChart 
          :title="t('analytics.charts.humidityTitle')"
          :subtitle="t('analytics.charts.humiditySub')"
          :sectionLabel="t('analytics.section.sensor')"
          color="var(--status-info)"
          gradientId="humidGrad"
          :data="humidityData"
          :dayLabels="dayLabels"
          :scaleFactor="1.5"
        />

        <!-- Health distribution -->
        <div class="glass-card an-chart-card">
          <p class="an-section-eye">{{ t('analytics.section.overview') }}</p>
          <h3 class="an-chart-title">{{ t('analytics.charts.healthTitle') }}</h3>
          <p class="an-chart-sub">{{ t('analytics.charts.healthSub') }}</p>
          <div class="an-pie-wrap">
            <svg viewBox="0 0 100 100" class="an-pie-svg">
              <circle class="an-pie-healthy" cx="50" cy="50" r="35" fill="none" stroke-width="12"
                :stroke-dasharray="`${healthDistribution.healthy} ${100 - healthDistribution.healthy}`"/>
              <circle class="an-pie-warning" cx="50" cy="50" r="35" fill="none" stroke-width="12"
                :stroke-dasharray="`${healthDistribution.warning} ${100 - healthDistribution.warning}`"
                :stroke-dashoffset="`${-healthDistribution.healthy}`"/>
              <circle class="an-pie-critical" cx="50" cy="50" r="35" fill="none" stroke-width="12"
                :stroke-dasharray="`${healthDistribution.critical} ${100 - healthDistribution.critical}`"
                :stroke-dashoffset="`${-(healthDistribution.healthy + healthDistribution.warning)}`"/>
            </svg>
          </div>
          <div class="an-legend">
            <div class="an-legend-item"><span class="an-dot is-healthy"></span><span>{{ t('analytics.legend.healthy') }} ({{ healthyPlants }})</span></div>
            <div class="an-legend-item"><span class="an-dot is-warning"></span><span>{{ t('analytics.legend.warning') }} ({{ warningCount }})</span></div>
            <div class="an-legend-item"><span class="an-dot is-critical"></span><span>{{ t('analytics.legend.critical') }} ({{ criticalCount }})</span></div>
          </div>
        </div>

        <!-- Soil Moisture metric -->
        <div class="glass-card an-chart-card">
          <p class="an-section-eye">{{ t('analytics.section.sensor') }}</p>
          <h3 class="an-chart-title">{{ t('analytics.charts.soilTitle') }}</h3>
          <p class="an-chart-sub">{{ t('analytics.charts.soilSub') }}</p>
          <div class="an-metric-display">
            <div class="an-metric-circle is-soil">
              <p class="an-metric-val">{{ summary.avgSoilMoisture.toFixed(1) }}%</p>
              <p class="an-metric-lbl">{{ t('analytics.charts.soilLabel') }}</p>
            </div>
            <div class="an-metric-info">
              <div class="an-info-item">
                <i class="pi pi-info-circle"></i>
                <span>{{ t('analytics.charts.soilReadings', { count: summary.totalReadings }) }}</span>
              </div>
              <div class="an-info-item">
                <i class="pi pi-check-circle"></i>
                <span>{{ t('analytics.charts.soilOptimal') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Light Level metric -->
        <div class="glass-card an-chart-card">
          <p class="an-section-eye">{{ t('analytics.section.sensor') }}</p>
          <h3 class="an-chart-title">{{ t('analytics.charts.lightTitle') }}</h3>
          <p class="an-chart-sub">{{ t('analytics.charts.lightSub') }}</p>
          <div class="an-metric-display">
            <div class="an-metric-circle is-light">
              <p class="an-metric-val">{{ summary.avgLight.toFixed(0) }}</p>
              <p class="an-metric-lbl">{{ t('analytics.charts.lightLabel') }}</p>
            </div>
            <div class="an-metric-info is-light">
              <div class="an-info-item">
                <i class="pi pi-sun"></i>
                <span>{{ t('analytics.charts.lightAverage') }}</span>
              </div>
              <div class="an-info-item">
                <i class="pi pi-chart-bar"></i>
                <span>{{ t('analytics.stats.readings', { count: summary.totalReadings }) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Historical card -->
      <div v-if="hasHistoricalData" class="glass-card an-historical">
        <div class="an-hist-header">
          <div>
            <p class="an-section-eye">{{ t('analytics.section.history') }}</p>
            <h3 class="an-chart-title">{{ t('analytics.charts.historicalTitle') }}</h3>
            <p class="an-chart-sub">{{ t('analytics.charts.historicalSub') }}</p>
          </div>
          <div class="an-hist-actions">
            <!-- Premium promo (EC-02 · panel de historial / retención 24m) -->
            <PremiumPromo feature="premium_history" />
            <button class="an-refresh-btn" @click="loadHistoricalData" :class="{ 'an-refresh-btn--loading': loadingHistory }">
              <i class="pi pi-refresh"></i> {{ t('analytics.charts.refresh') }}
            </button>
          </div>
        </div>

        <div class="an-hist-grid">
           <div class="an-hist-item">
             <div class="an-hist-icon is-warning">
               <i class="pi pi-sun"></i>
             </div>
             <div>
               <p class="an-hist-label">{{ t('analytics.historical.temperature') }}</p>
               <p class="an-hist-val">{{ historicalData ? historicalData.avgTemperature.toFixed(1) : 0 }}°C</p>
               <p class="an-hist-range">{{ historicalData ? `${(historicalData.minTemperature ?? 0).toFixed(1)}°C – ${(historicalData.maxTemperature ?? 0).toFixed(1)}°C` : '0°C – 0°C' }}</p>
             </div>
           </div>
           <div class="an-hist-item">
             <div class="an-hist-icon is-info">
               <i class="pi pi-cloud"></i>
             </div>
             <div>
               <p class="an-hist-label">{{ t('analytics.historical.humidity') }}</p>
               <p class="an-hist-val">{{ historicalData ? historicalData.avgHumidity.toFixed(1) : 0 }}%</p>
               <p class="an-hist-range">{{ historicalData ? t('analytics.historical.lastReadings', { count: historicalData.count }) : t('analytics.historical.lastReadings', { count: 0 }) }}</p>
             </div>
           </div>
           <div class="an-hist-item">
             <div class="an-hist-icon is-success">
               <i class="pi pi-ticket"></i>
             </div>
             <div>
               <p class="an-hist-label">{{ t('analytics.historical.soilMoisture') }}</p>
               <p class="an-hist-val">{{ historicalData ? historicalData.avgSoilMoisture.toFixed(1) : 0 }}%</p>
               <p class="an-hist-range">{{ t('analytics.historical.averageLevel') }}</p>
             </div>
           </div>
           <div class="an-hist-item">
             <div class="an-hist-icon is-warning">
               <i class="pi pi-bolt"></i>
             </div>
             <div>
               <p class="an-hist-label">{{ t('analytics.historical.lightLevel') }}</p>
               <p class="an-hist-val">{{ historicalData ? historicalData.avgLight.toFixed(0) : 0 }}</p>
               <p class="an-hist-range">{{ t('analytics.charts.lightAverage') }}</p>
             </div>
           </div>
        </div>

         <div v-if="historicalData && historicalData.period.start" class="an-period">
           <i class="pi pi-calendar"></i>
           <span>{{ t('analytics.historical.period', { start: new Date(String(historicalData.period.start)).toLocaleDateString(locale), end: new Date(String(historicalData.period.end)).toLocaleDateString(locale) }) }}</span>
         </div>
      </div>

      <!-- No historical data -->
      <div v-else-if="!loadingHistory" class="an-fullstate an-fullstate--compact glass-card">
        <div class="an-state-icon is-muted">
          <i class="pi pi-history"></i>
        </div>
        <h3 class="an-state-title">{{ t('analytics.empty.noHistory.title') }}</h3>
        <p class="an-state-sub">{{ t('analytics.empty.noHistory.subtitle') }}</p>
      </div>

    </template>
  </div>
</template>

<style scoped>
.an-wrap {
  max-width: 1400px;
  margin: 1.5rem auto;
  padding: 0 1rem 2rem;
  color: var(--text-primary);
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.an-wrap::before,
.an-wrap::after {
  content: '';
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(52px);
  opacity: 0.3;
  z-index: -1;
  pointer-events: none;
}
.an-wrap::before { width: 300px; height: 300px; top: 80px; right: -70px; background: var(--primary-green-light); }
.an-wrap::after { width: 240px; height: 240px; left: -60px; bottom: 60px; background: var(--surface-info-soft); }

/* Loading */
.an-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 3rem 1rem;
  text-align: center;
}

.an-loading-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.an-loading-icon {
  font-size: 1.5rem;
  color: var(--primary-green);
}

.an-loading h2 {
  margin: 0;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
}

/* Full states (error / empty) */
.an-fullstate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 340px;
  text-align: center;
  gap: 0.9rem;
}

.an-fullstate--compact {
  min-height: 200px;
}

.an-state-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.an-state-icon i {
  font-size: 1.6rem;
}

.an-state-icon.is-danger { background: var(--surface-danger-soft); color: var(--status-critical); }
.an-state-icon.is-info { background: var(--surface-info-soft); color: var(--status-info); }
.an-state-icon.is-success { background: var(--surface-success-soft); color: var(--status-success); }
.an-state-icon.is-muted { background: var(--surface-muted); color: var(--text-secondary); }
.an-state-icon.is-muted i { font-size: 1.5rem; }

.an-state-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
}

.an-state-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  max-width: 380px;
}

.an-state-hint {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.82rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
}

.an-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-full);
  padding: 0.6rem 1.3rem;
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #fff;
  cursor: pointer;
  box-shadow: var(--shadow-green);
  transition: transform 0.18s, box-shadow 0.18s;
}

.an-retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-green);
}

.an-cta-btn {
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-full);
  color: #fff;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-green);
}

/* Sections */
.an-section-eye {
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--primary-green);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  margin: 0 0 0.25rem;
}

.an-chart-title {
  font-size: 1.05rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  color: var(--text-primary);
  margin: 0 0 0.2rem;
}

.an-chart-sub {
  font-size: 0.82rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.an-charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 1rem;
}

.an-chart-card {
  min-height: 320px;
}

/* Pie */
.an-pie-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
}

.an-pie-svg {
  width: 130px;
  height: 130px;
  transform: rotate(-90deg);
}

.an-pie-healthy { stroke: var(--status-success); }
.an-pie-warning { stroke: var(--status-warning); }
.an-pie-critical { stroke: var(--status-critical); }

.an-legend {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.an-legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.an-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.an-dot.is-healthy { background: var(--status-success); }
.an-dot.is-warning { background: var(--status-warning); }
.an-dot.is-critical { background: var(--status-critical); }

/* Metric display */
.an-metric-display {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 1.5rem;
  padding: 1rem 0;
}

.an-metric-circle {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.an-metric-circle.is-soil { background: var(--surface-success-soft); }
.an-metric-circle.is-light { background: var(--surface-warning-soft); }

.an-metric-val {
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  color: var(--text-primary);
  margin-bottom: 0.4rem;
}

.an-metric-lbl {
  font-size: 0.65rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.an-metric-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.an-info-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.9rem;
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  color: var(--text-secondary);
}

.an-info-item i {
  color: var(--primary-green);
}

.an-metric-info.is-light .an-info-item i {
  color: var(--status-warning);
}

/* Historical */
.an-historical {
  padding: 1.5rem 1.75rem;
}

.an-hist-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.an-hist-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.an-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.18s, transform 0.15s;
}

.an-refresh-btn:hover {
  background: var(--gradient-primary);
  color: #fff;
  border-color: transparent;
  transform: translateY(-1px);
}

.an-refresh-btn--loading { opacity: 0.6; pointer-events: none; }
.an-refresh-btn--loading i { animation: an-spin 1s linear infinite; }

.an-hist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.an-hist-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.9rem 1rem;
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: border-color 0.18s, transform 0.15s;
}

.an-hist-item:hover {
  border-color: var(--primary-green);
  transform: translateY(-1px);
}

.an-hist-icon {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.1rem;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.an-hist-icon.is-warning { background: var(--surface-warning-soft); color: var(--status-warning); }
.an-hist-icon.is-info { background: var(--surface-info-soft); color: var(--status-info); }
.an-hist-icon.is-success { background: var(--surface-success-soft); color: var(--status-success); }

.an-hist-label {
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  margin: 0;
}

.an-hist-val {
  font-size: 1.3rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  color: var(--text-primary);
  margin: 0.2rem 0;
}

.an-hist-range {
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  color: var(--text-tertiary);
  margin: 0;
}

.an-period {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  background: color-mix(in srgb, var(--bg-secondary) 55%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  color: var(--text-secondary);
}

.an-period i {
  color: var(--text-tertiary);
}

@keyframes an-spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 992px) {
  .an-charts-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .an-hist-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .an-hist-grid { grid-template-columns: 1fr; }
  .an-wrap { padding: 0 0.55rem 1.5rem; }
}
</style>
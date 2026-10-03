<script setup lang="ts">
import { useDashboard } from '../composables/useDashboard';
import Button from 'primevue/button';
import { useI18n } from 'vue-i18n';

const {
  loading,
  error,
  stats,
  recentActivities,
  nextWateringPlant,
  handleWaterNow,
  handleViewAll,
} = useDashboard();

const { t } = useI18n();

// ---------------------------------------------------------------------------
// Mapas de iconos futuristas (SVG) para reemplazar emojis sin tocar la lógica
// ---------------------------------------------------------------------------
const statIcons: Record<string, string> = {
  totalPlants: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V10"/><path d="M12 10c-3 0-5.5-2-5.5-5.5C6.5 1.5 9 0 12 0s5.5 1.5 5.5 4.5C17.5 8 15 10 12 10z"/><path d="M12 16c-1.5 0-3-1-3-2.5S10.5 11 12 11s3 1 3 2.5S13.5 16 12 16z"/><line x1="5" y1="22" x2="19" y2="22"/></svg>`,
  activeAlerts: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
  avgHumidity: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  healthScore: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
};

const activityIcons: Record<string, string> = {
  watered: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  added: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  moved: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  checked: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

const getStatIcon = (key: string) => statIcons[key] || statIcons.totalPlants;
const getActivityIcon = (type: string) => activityIcons[type] || activityIcons.checked;
</script>

<template>
  <div class="dashboard">
    <!-- Partículas de fondo -->
    <div class="bg-particles" aria-hidden="true"></div>

    <div v-if="loading" class="state-message">
      <div class="loading-spinner">
        <span class="spinner-core"></span>
      </div>
      <p>{{ t('dashboard.loading') }}</p>
    </div>

    <div v-else-if="error" class="state-message">
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <!-- Tarjetas de estadísticas -->
      <div class="stats-grid">
        <div
            v-for="(stat, index) in stats"
            :key="stat.label || index"
            class="stat-card"
        >
          <div class="stat-glow"></div>
          <div class="stat-header">
            <div>
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
              <span
                  v-if="stat.trend"
                  :class="['stat-trend', stat.trendUp ? 'up' : 'down']"
              >
                {{ stat.trendUp ? '↑' : '↓' }} {{ stat.trend }}
              </span>
            </div>
            <div class="stat-icon" v-html="getStatIcon(stat.key)"></div>
          </div>
        </div>
      </div>

      <!-- Siguiente riego -->
      <div v-if="nextWateringPlant" class="next-watering-card">
        <div class="next-watering-content">
          <div class="next-watering-label">{{ t('dashboard.nextPlant') }}</div>
          <div class="next-watering-plant">{{ nextWateringPlant.plantName }}</div>
          <div class="next-watering-time">{{ nextWateringPlant.timeDue }} • {{ nextWateringPlant.location }}</div>
        </div>
        <Button
            class="next-watering-button"
            :label="t('dashboard.waterNow')"
            @click="handleWaterNow"
        />
      </div>

      <!-- Actividad reciente -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-title-accent"></span>
            {{ t('dashboard.recentActivity') }}
          </h2>
          <Button
              :label="t('dashboard.viewAll')"
              outlined
              @click="handleViewAll"
          />
        </div>

        <div class="recent-activity">
          <div class="activity-list">
            <div
                v-for="(activity, index) in recentActivities"
                :key="activity.title || index"
                class="activity-item"
            >
              <div class="activity-icon" v-html="getActivityIcon(activity.type)"></div>
              <div class="activity-content">
                <div class="activity-title">{{ activity.title }}</div>
                <div class="activity-description">{{ activity.description }}</div>
              </div>
              <div class="activity-time">{{ activity.time }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------
   DASHBOARD – Glass sobre los tokens globales
   ---------------------------------------------------------- */
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  isolation: isolate;
  padding: 1rem;
  color: var(--text-primary);
}

/* Fondo animado de partículas */
.bg-particles {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.4;
  background-image:
    radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--primary-green) 15%, transparent) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--status-info) 10%, transparent) 0%, transparent 35%),
    radial-gradient(circle at 40% 80%, color-mix(in srgb, var(--primary-green) 8%, transparent) 0%, transparent 40%);
  animation: particleFloat 12s infinite alternate ease-in-out;
}

@keyframes particleFloat {
  0% { transform: translateY(0) scale(1); opacity: 0.4; }
  100% { transform: translateY(-10px) scale(1.02); opacity: 0.6; }
}

/* Estados de carga y error */
.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: var(--spacing-2xl);
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
}

.loading-spinner {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  display: grid;
  place-items: center;
  animation: spin 1.5s linear infinite;
}

.spinner-core {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Estructura de sección */
.section {
  margin-bottom: var(--spacing-2xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  letter-spacing: -0.02em;
}

.section-title-accent {
  width: 6px;
  height: 24px;
  background: var(--gradient-primary);
  border-radius: 3px;
  display: inline-block;
  box-shadow: 0 0 10px var(--primary-green);
}

/* ----------------------------------------------------------
   TARJETAS DE ESTADÍSTICAS
   ---------------------------------------------------------- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.stat-card {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  backdrop-filter: blur(18px);
  z-index: 1;
}

/* Línea de energía en la parte superior */
.stat-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--primary-green), var(--secondary-green), var(--primary-green), transparent);
  opacity: 0;
  transition: opacity 0.4s;
  box-shadow: 0 0 12px var(--primary-green);
}

.stat-card:hover .stat-glow {
  opacity: 1;
}

.stat-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-xl);
  border-color: var(--primary-green);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  z-index: 2;
}

.stat-icon {
  width: 56px;
  height: 56px;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: var(--shadow-green);
  transition: all 0.3s ease;
  color: #fff;
}

.stat-card:hover .stat-icon {
  transform: rotate(10deg) scale(1.1);
  box-shadow: 0 0 20px color-mix(in srgb, var(--primary-green) 60%, transparent);
}

.stat-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-extrabold);
  color: var(--text-primary);
  line-height: 1;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.03em;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 6px 10px;
  border-radius: var(--radius-full);
  margin-top: var(--spacing-sm);
}

.stat-trend.up {
  background: color-mix(in srgb, var(--status-success) 15%, transparent);
  color: var(--status-success);
}

.stat-trend.down {
  background: color-mix(in srgb, var(--status-critical) 15%, transparent);
  color: var(--status-critical);
}

/* ----------------------------------------------------------
   TARJETA DE SIGUIENTE RIEGO
   ---------------------------------------------------------- */
.next-watering-card {
  background: var(--gradient-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  color: #fff;
  box-shadow: var(--shadow-green);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
  position: relative;
  overflow: hidden;
  transition: all 0.4s ease;
  isolation: isolate;
}

/* Brillo dinámico */
.next-watering-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 60%);
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.4s, transform 0.4s;
  pointer-events: none;
}

.next-watering-card:hover::before {
  opacity: 1;
  transform: scale(1);
}

.next-watering-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-green);
}

.next-watering-content {
  flex: 1;
  position: relative;
  z-index: 2;
}

.next-watering-label {
  font-size: var(--font-size-sm);
  opacity: 0.95;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.next-watering-plant {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-extrabold);
  margin-bottom: var(--spacing-sm);
  text-shadow: 0 2px 12px rgba(0,0,0,0.15);
  letter-spacing: -0.02em;
}

.next-watering-time {
  font-size: var(--font-size-base);
  opacity: 0.95;
  font-weight: var(--font-weight-medium);
}

.next-watering-button {
  background: #fff;
  color: var(--primary-green);
  padding: 14px 32px;
  border-radius: var(--radius-lg);
  border: none;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 2;
}

.next-watering-button:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--shadow-md);
}

/* ----------------------------------------------------------
   ACTIVIDAD RECIENTE
   ---------------------------------------------------------- */
.recent-activity {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.activity-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
  border: 1px solid transparent;
}

/* Línea de tiempo sutil */
.activity-item::after {
  content: '';
  position: absolute;
  left: 23px;
  top: 48px;
  bottom: -12px;
  width: 2px;
  background: var(--border-color);
}

.activity-item:last-child::after {
  display: none;
}

.activity-item:hover {
  transform: translateX(8px);
  background: color-mix(in srgb, var(--primary-green) 4%, transparent);
  border-color: var(--border-color);
  box-shadow: var(--shadow-sm);
}

.activity-icon {
  width: 48px;
  height: 48px;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
  color: #fff;
  position: relative;
  z-index: 2;
}

.activity-item:hover .activity-icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 0 16px color-mix(in srgb, var(--primary-green) 50%, transparent);
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: 4px;
  font-size: var(--font-size-base);
  letter-spacing: -0.01em;
}

.activity-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.activity-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
}

/* ----------------------------------------------------------
   RESPONSIVE
   ---------------------------------------------------------- */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .next-watering-card {
    flex-direction: column;
    text-align: center;
    gap: var(--spacing-lg);
  }

  .next-watering-button {
    width: 100%;
  }

  .activity-item::after {
    left: 19px;
  }
}
</style>
<script setup lang="ts">
import type { Plant } from "../../domain/model/plants.entity";
import PlantAnalyticsCalculator from "../../application/plantAnalytics";
import Button from "primevue/button";
import { computed } from "vue";
import { useI18n } from 'vue-i18n';

interface Props {
  plant: Plant | null;
  loading?: boolean;
}

const emit = defineEmits<{
  water: [];
}>();

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const { t, locale } = useI18n();

const schedule = computed(() => {
  if (!props.plant) return null;
  return PlantAnalyticsCalculator.getWateringSchedule(props.plant);
});

const urgency = computed(() => {
  if (!schedule.value) return null;
  return PlantAnalyticsCalculator.getUrgencyIndicator(schedule.value.urgency);
});

const urgencyMessage = computed(() => {
  if (!schedule.value) return '';
  const key = schedule.value.urgency || 'unknown';
  return t(`watering.urgency.${key}.message`);
});

const urgencyAction = computed(() => {
  if (!schedule.value) return '';
  const key = schedule.value.urgency || 'unknown';
  return t(`watering.urgency.${key}.action`);
});

const scheduleTimingText = computed(() => {
  if (!schedule.value) return '';
  if (schedule.value.daysUntilWatering >= 0) {
    return schedule.value.daysUntilWatering < 1
      ? t('watering.schedule.today')
      : t('watering.schedule.inDays', { days: schedule.value.daysUntilWatering.toFixed(1) });
  }
  return t('watering.schedule.overdue');
});

const handleWater = () => {
  emit('water');
};
</script>

<template>
  <div v-if="schedule && urgency" class="watering-card">
    <div class="watering-header">
      <div class="urgency-indicator">
        <span class="urgency-emoji">{{ urgency.emoji }}</span>
        <div class="urgency-text">
          <h3>{{ urgencyMessage }}</h3>
          <p>{{ scheduleTimingText }}</p>
        </div>
      </div>
      <Button
        :icon="loading ? 'pi pi-spin pi-spinner' : 'pi pi-droplet'"
        :label="urgencyAction"
        :loading="loading"
        @click="handleWater"
        class="water-button"
      />
    </div>

    <div class="schedule-reason">
      <p>{{ schedule.reason }}</p>
    </div>

    <div class="next-watering-date" v-if="schedule.nextWatering">
      <i class="pi pi-calendar"></i>
      <span>{{ new Date(schedule.nextWatering).toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.watering-card {
  border-radius: var(--radius-md);
  border: 2px solid color-mix(in srgb, var(--primary-green) 45%, transparent);
  background: var(--primary-green-light);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.watering-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.urgency-indicator {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.urgency-emoji {
  font-size: 2rem;
  line-height: 1;
}

.urgency-text h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
}

.urgency-text p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.water-button {
  background: var(--gradient-primary);
  border: none;
  color: #fff;
  box-shadow: var(--shadow-green);
  transition: transform 0.18s, box-shadow 0.18s;
}

.water-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-green);
}

.schedule-reason {
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.schedule-reason p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.next-watering-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--primary-green);
  font-weight: var(--font-weight-semibold);
  padding-top: 1rem;
  border-top: 1px solid color-mix(in srgb, var(--primary-green) 20%, transparent);
}

@media (max-width: 768px) {
  .watering-header {
    flex-direction: column;
  }

  .water-button {
    width: 100%;
  }
}
</style>

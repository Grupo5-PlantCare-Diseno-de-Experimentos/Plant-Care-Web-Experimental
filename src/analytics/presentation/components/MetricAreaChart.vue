<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  subtitle: string;
  sectionLabel: string;
  color: string;
  gradientId: string;
  data: { value: number; day?: string }[];
  dayLabels: string[];
  scaleFactor?: number;
  useMaxScale?: boolean;
}>();

const points = computed(() => {
  if (props.data.length === 0) return '25,90';
  if (props.useMaxScale) {
    const maxVal = Math.max(...props.data.map(d => d.value), 1);
    return props.data.map((point, i) => `${i * 50 + 25},${180 - (point.value / maxVal) * 150}`).join(' ');
  } else {
    const factor = props.scaleFactor || 1;
    return props.data.map((point, i) => `${i * 50 + 25},${180 - (point.value * factor)}`).join(' ');
  }
});

const areaPoints = computed(() => {
  const pts = points.value;
  if (!pts || pts === '25,90') return '25,180 25,180';
  return `25,180 ${pts} ${(props.data.length - 1) * 50 + 25},180`;
});
</script>

<template>
  <div class="glass-card an-chart-card">
    <p class="an-section-eye">{{ sectionLabel }}</p>
    <h3 class="an-chart-title">{{ title }}</h3>
    <p class="an-chart-sub">{{ subtitle }}</p>
    <div class="an-chart-area">
      <svg class="an-svg" viewBox="0 0 350 180" :style="{ '--chart-color': color }">
        <defs>
          <linearGradient :id="gradientId" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop class="an-stop-top" offset="0%"/>
            <stop class="an-stop-bottom" offset="100%"/>
          </linearGradient>
        </defs>
        <polygon :points="areaPoints" :fill="`url(#${gradientId})`"/>
        <polyline :points="points" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle v-for="(point, i) in data" :key="i"
          :cx="i * 50 + 25"
          :cy="useMaxScale ? 180 - (point.value / Math.max(...data.map(d => d.value), 1)) * 150 : 180 - (point.value * (scaleFactor || 1))"
          r="4" stroke-width="2"/>
      </svg>
      <div class="an-chart-labels">
        <span v-for="day in dayLabels" :key="day">{{ day }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.an-chart-card {
  min-height: 320px;
}

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

.an-chart-area {
  margin-top: 0.5rem;
}

.an-svg {
  width: 100%;
  height: 180px;
}

.an-stop-top {
  stop-color: var(--chart-color);
  stop-opacity: 0.28;
}

.an-stop-bottom {
  stop-color: var(--chart-color);
  stop-opacity: 0;
}

.an-svg polyline {
  stroke: var(--chart-color);
}

.an-svg circle {
  fill: var(--chart-color);
  stroke: var(--bg-secondary);
}

.an-chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0.3rem 0;
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PremiumModal from './PremiumModal.vue';
import { trackingService } from '../tracking/tracking.service';
import { PREMIUM_PROMOTIONS, type PremiumFeatureId } from './premium.entity';

const props = defineProps<{ feature: PremiumFeatureId }>();

const { t } = useI18n();
const modalVisible = ref(false);
const promo = PREMIUM_PROMOTIONS[props.feature];

function openModal() {
  // Evento select_promotion (Tracking Plan 8.2.8).
  trackingService.track({
    eventName: 'select_promotion',
    promotionId: promo.promotionId,
    promotionName: promo.promotionName,
    location: promo.location,
  });
  modalVisible.value = true;
}
</script>

<template>
  <a
    :id="promo.anchorId"
    class="premium-cta"
    role="button"
    tabindex="0"
    :aria-label="t('premium.cta')"
    @click="openModal"
    @keydown.enter.prevent="openModal"
    @keydown.space.prevent="openModal"
  >
    <i class="pi pi-star-fill"></i>
    <span>{{ t('premium.cta') }}</span>
  </a>

  <PremiumModal v-model:visible="modalVisible" :feature="feature" />
</template>

<style scoped>
.premium-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-full, 999px);
  border: 1px solid color-mix(in srgb, #f5b301 50%, transparent);
  background: color-mix(in srgb, #f5b301 12%, transparent);
  color: #b58100;
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  text-decoration: none;
}
.premium-cta:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, #f5b301 20%, transparent);
}
.premium-cta i { font-size: 0.85em; }
</style>

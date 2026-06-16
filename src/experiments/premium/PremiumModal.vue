<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackingService } from '../tracking/tracking.service';
import { premiumLeadsService } from './premium-leads.service';
import { PREMIUM_PROMOTIONS, SIMULATED_PLAN_ID, type PremiumFeatureId } from './premium.entity';

const props = defineProps<{
  visible: boolean;
  feature: PremiumFeatureId;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const { t } = useI18n();

const submitting = ref(false);
const confirmed = ref(false);

// Dispara view_promotion cada vez que el modal se hace visible (Escenario 01 US-042).
watch(
  () => props.visible,
  (isOpen) => {
    if (!isOpen) return;
    confirmed.value = false;
    trackingService.track({
      eventName: 'view_promotion',
      promotionId: 'premium_modal',
      location: 'modal_overlay',
      metadata: { source_feature: props.feature },
    });
  }
);

function close() {
  emit('update:visible', false);
}

async function startTrial() {
  if (submitting.value) return;
  submitting.value = true;

  const promo = PREMIUM_PROMOTIONS[props.feature];

  // Evento purchase_simulation (Tracking Plan 8.2.8).
  trackingService.track({
    eventName: 'purchase_simulation',
    promotionId: promo.promotionId,
    promotionName: promo.promotionName,
    location: 'modal_overlay',
    metadata: { plan_id: SIMULATED_PLAN_ID, simulated: true },
  });

  try {
    await premiumLeadsService.registerLead(props.feature);
    confirmed.value = true;
  } catch (e) {
    console.warn('[Premium] No se pudo registrar el lead:', e);
    // Aun así mostramos el agradecimiento: la prueba es simulada.
    confirmed.value = true;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Transition name="pm-fade">
    <div v-if="visible" class="pm-overlay" role="dialog" aria-modal="true"
         :aria-label="t('premium.modal.title')" @click.self="close">
      <div class="pm-card">
        <button class="pm-close" :aria-label="t('common.close')" @click="close">
          <i class="pi pi-times"></i>
        </button>

        <!-- Estado: oferta -->
        <template v-if="!confirmed">
          <span class="pm-eyebrow">{{ t('premium.modal.eyebrow') }}</span>
          <h2 class="pm-title">{{ t('premium.modal.title') }}</h2>
          <p class="pm-subtitle">{{ t('premium.modal.subtitle') }}</p>

          <ul class="pm-benefits">
            <li><i class="pi pi-check-circle"></i>{{ t('premium.modal.benefitDiagnosis') }}</li>
            <li><i class="pi pi-check-circle"></i>{{ t('premium.modal.benefitRetention') }}</li>
            <li><i class="pi pi-check-circle"></i>{{ t('premium.modal.benefitSupport') }}</li>
          </ul>

          <div class="pm-price">
            <span class="pm-price__amount">{{ t('premium.modal.price') }}</span>
            <span class="pm-price__period">{{ t('premium.modal.period') }}</span>
          </div>

          <button id="btn-start-trial" class="pm-cta" :disabled="submitting" @click="startTrial">
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
            <span>{{ t('premium.modal.startTrial') }}</span>
          </button>

          <p class="pm-disclaimer">{{ t('premium.modal.disclaimer') }}</p>
        </template>

        <!-- Estado: agradecimiento -->
        <template v-else>
          <div class="pm-thanks">
            <div class="pm-thanks__icon">🌟</div>
            <h2 class="pm-title">{{ t('premium.modal.thanksTitle') }}</h2>
            <p class="pm-subtitle">{{ t('premium.modal.thanksBody') }}</p>
            <button class="pm-cta" @click="close">{{ t('common.close') }}</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.pm-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-2xl, 24px);
  padding: var(--spacing-2xl, 32px) var(--spacing-xl, 24px);
  box-shadow: var(--shadow-xl);
  text-align: center;
  animation: pm-pop 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes pm-pop {
  from { transform: translateY(16px) scale(0.97); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.pm-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary, #f4f4f5);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}
.pm-close:hover { background: var(--border-color); }

.pm-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--primary-green, #34c759);
}

.pm-title {
  font-size: var(--font-size-xl, 1.4rem);
  font-weight: 800;
  color: var(--text-primary);
  margin: var(--spacing-sm) 0;
}

.pm-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-lg);
}

.pm-benefits {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing-lg);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.pm-benefits li {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}
.pm-benefits i { color: var(--primary-green, #34c759); }

.pm-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin-bottom: var(--spacing-lg);
}
.pm-price__amount {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
}
.pm-price__period {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.pm-cta {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 14px var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg, 14px);
  background: var(--gradient-primary, var(--primary-green, #34c759));
  color: #fff;
  font-weight: 700;
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.pm-cta:hover:not(:disabled) { transform: translateY(-2px); }
.pm-cta:disabled { opacity: 0.7; cursor: not-allowed; }

.pm-disclaimer {
  margin: var(--spacing-md) 0 0;
  font-size: 11px;
  color: var(--text-tertiary, var(--text-secondary));
}

.pm-thanks__icon { font-size: 3rem; margin-bottom: var(--spacing-sm); }

.pm-fade-enter-active, .pm-fade-leave-active { transition: opacity 0.25s ease; }
.pm-fade-enter-from, .pm-fade-leave-to { opacity: 0; }

@media (max-width: 480px) {
  .pm-card { padding: var(--spacing-xl) var(--spacing-lg); border-radius: 18px; }
  .pm-price__amount { font-size: 1.6rem; }
}
</style>

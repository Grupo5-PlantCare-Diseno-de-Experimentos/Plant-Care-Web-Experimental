<template>
  <div class="pf-wrap">
    <Button
      icon="pi pi-arrow-left"
      :label="t('plantForm.back')"
      text
      @click="goBack"
      class="back-button"
    />

    <div class="pf-card">
      <p class="pf-eyebrow">{{ t('plantForm.eyebrow') }}</p>
      <h2 class="pf-title">{{ isEditing ? t('plantForm.titleEdit') : t('plantForm.titleAdd') }}</h2>

      <span class="pf-status-chip">
        <i class="pi pi-leaf"></i>
        {{ isEditing ? t('plantForm.statusEditing') : t('plantForm.statusNew') }}
      </span>

      <form @submit.prevent="onSubmit" class="pf-grid">
        <div class="pf-row">
          <div class="pf-field">
            <label for="name">{{ t('plantForm.field.name') }}</label>
            <InputText id="name" v-model="form.name" :placeholder="t('plantForm.placeholder.name')" />
            <small v-if="errors.name" class="pf-error">{{ errors.name }}</small>
          </div>
          <div class="pf-field">
            <label for="type">{{ t('plantForm.field.type') }}</label>
            <InputText id="type" v-model="form.type" :placeholder="t('plantForm.placeholder.type')" />
            <small v-if="errors.type" class="pf-error">{{ errors.type }}</small>
          </div>
        </div>

        <div class="pf-row">
          <div class="pf-field">
            <label for="imgUrl">{{ t('plantForm.field.image') }}</label>
            <InputText id="imgUrl" v-model="form.imgUrl" :placeholder="t('plantForm.placeholder.image')" />
            <small class="pf-hint">{{ t('plantForm.hint.image') }}</small>
          </div>
          <div class="pf-field">
            <label for="location">{{ t('plantForm.field.location') }}</label>
            <InputText id="location" v-model="form.location" :placeholder="t('plantForm.placeholder.location')" />
          </div>
        </div>

        <div class="pf-field">
          <label for="deviceId">{{ t('plantForm.field.deviceId') }}</label>
          <select id="deviceId" v-model="sensorChoice" class="pf-select">
            <option value="">{{ t('plantForm.sensor.none') }}</option>
            <option
              v-for="device in detectedDevices"
              :key="device.deviceId"
              :value="device.deviceId"
            >
              {{ device.deviceId }}
            </option>
            <option value="__manual__">{{ t('plantForm.sensor.manual') }}</option>
          </select>
          <InputText
            v-if="sensorChoice === '__manual__'"
            v-model="form.deviceId"
            :placeholder="t('plantForm.placeholder.deviceId')"
          />
          <small class="pf-hint">{{ t('plantForm.hint.deviceId') }}</small>
        </div>

        <div class="pf-field">
          <label for="bio">{{ t('plantForm.field.bio') }}</label>
          <Textarea id="bio" v-model="form.bio" rows="4" :placeholder="t('plantForm.placeholder.bio')" />
        </div>

        <div v-if="serverError.message" class="pf-server-error">
          <i class="pi pi-exclamation-circle"></i>
          {{ serverError.message }}
        </div>

        <hr class="pf-divider" />

        <div class="pf-actions">
          <Button type="button" class="btn-ghost" @click="onReset">{{ t('plantForm.action.reset') }}</Button>
          <Button type="submit" class="btn-primary" :loading="isSubmitting">
            {{ isEditing ? t('plantForm.action.update') : t('plantForm.action.save') }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../../auth/store/authStore';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import { PlantsService } from '../../infrastructure/plants.services';
import type { Plant } from '../../domain/model/plants.entity';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const route = useRoute();
const plantsService = new PlantsService();
const { t } = useI18n();

const authStore = useAuthStore();

const emptyState = (): Partial<Plant> => ({
  name: '',
  type: '',
  imgUrl: '',
  bio: '',
  location: '',
  deviceId: ''
});

const form = reactive<Partial<Plant>>({ ...emptyState() });
const errors = reactive<Record<string, string>>({});
const serverError = reactive<{ message: string | null }>({ message: null });
const isSubmitting = ref(false);
const detectedDevices = ref<Array<{ deviceId: string; lastSeen: string | null }>>([]);
const sensorChoice = ref('');

const isEditing = computed(() => !!route.params.id);

watch(sensorChoice, (choice) => {
  if (choice !== '__manual__') form.deviceId = choice;
});

async function loadDetectedDevices() {
  try {
    detectedDevices.value = await plantsService.getDetectedDevices();
  } catch {
    detectedDevices.value = [];
  }
}

onMounted(async () => {
  await loadDetectedDevices();

  if (isEditing.value) {
    try {
      const response = await plantsService.getPlantById(route.params.id as string);
      if (response.data) {
        Object.assign(form, {
          name: response.data.name,
          type: response.data.type,
          imgUrl: response.data.imgUrl,
          location: response.data.location,
          bio: response.data.bio,
        });

        const paired = (response.data.deviceId || '').trim();
        if (paired) {
          if (detectedDevices.value.some((device) => device.deviceId === paired)) {
            sensorChoice.value = paired;
          } else {
            form.deviceId = paired;
            sensorChoice.value = '__manual__';
          }
        } else {
          sensorChoice.value = detectedDevices.value.length ? '' : '__manual__';
        }
      }
    } catch (err) {
      serverError.message = t('plantForm.error.loadFailed');
    }
  } else {
    sensorChoice.value = detectedDevices.value.length ? '' : '__manual__';
  }
});

const validate = () => {
  errors.name = form.name && form.name.trim() ? '' : t('plantForm.error.nameRequired');
  errors.type = form.type && form.type.trim() ? '' : t('plantForm.error.typeRequired');
  return !Object.values(errors).some(v => v);
};

const onSubmit = async () => {
  serverError.message = null;
  if (!validate()) return;

  if (!authStore.isSignedIn || !authStore.token) {
    serverError.message = t('plantForm.error.mustSignIn');
    setTimeout(() => router.push({ name: 'SignIn' }), 2000);
    return;
  }

  const userId = authStore.userId || '';
  if (!userId) {
    serverError.message = t('plantForm.error.noUserId');
    return;
  }

  const payload = {
    userId,
    name: String(form.name || '').trim(),
    type: String(form.type || '').trim(),
    imgUrl: String(form.imgUrl || '').trim() || 'https://via.placeholder.com/180',
    bio: String(form.bio || '').trim(),
    location: String(form.location || '').trim(),
    deviceId: String(form.deviceId || '').trim()
  };

  try {
    isSubmitting.value = true;
    if (isEditing.value) {
      await plantsService.updatePlant(route.params.id as string, {
        name: payload.name,
        type: payload.type,
        imgUrl: payload.imgUrl,
        bio: payload.bio,
        location: payload.location,
        deviceId: payload.deviceId
      });
    } else {
      const createResponse = await plantsService.createPlant(payload);
      const newPlantId = createResponse.data.id;
      if (newPlantId) {
        const now = new Date().toISOString();
        await plantsService.waterPlant(newPlantId, userId, undefined, now);
      }
    }
    router.push('/plants');
  } catch (err: any) {
    if (err?.response?.status === 401) {
      serverError.message = t('plantForm.error.sessionExpired');
      setTimeout(async () => {
        await authStore.logout();
        router.push({ name: 'SignIn' });
      }, 2000);
    } else if (err?.response?.status === 403) {
      serverError.message = t('plantForm.error.noPermission');
    } else if (err?.response?.status === 400) {
      const backendMsg = err?.response?.data?.message || err?.response?.data || t('plantForm.error.invalidData');
      serverError.message = t('plantForm.error.validation', { message: backendMsg });
    } else {
      const backendMsg = err?.response?.data?.message || err?.message || t('plantForm.error.unknown');
      serverError.message = t('plantForm.error.generic', { message: backendMsg });
    }
  } finally {
    isSubmitting.value = false;
  }
};

const onReset = () => {
  Object.assign(form, emptyState());
  sensorChoice.value = detectedDevices.value.length ? '' : '__manual__';
  serverError.message = null;
};

const goBack = () => {
  router.push('/plants');
};
</script>

<style scoped>
.pf-wrap {
  max-width: 560px;
  margin: 1.5rem auto;
  padding: 0 1rem;
  color: var(--text-primary);
  position: relative;
  isolation: isolate;
}

.pf-wrap::before,
.pf-wrap::after {
  content: '';
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(52px);
  opacity: 0.35;
  z-index: -1;
  pointer-events: none;
}

.pf-wrap::before {
  width: 220px;
  height: 220px;
  top: -30px;
  right: -60px;
  background: var(--primary-green-light);
}

.pf-wrap::after {
  width: 180px;
  height: 180px;
  left: -50px;
  bottom: -20px;
  background: var(--surface-info-soft);
}

.back-button {
  margin-bottom: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: var(--font-weight-semibold);
  background: color-mix(in srgb, var(--bg-secondary) 58%, transparent);
}

.pf-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 2rem 1.75rem 1.75rem;
}

.pf-eyebrow {
  margin: 0 0 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--primary-green);
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
}

.pf-title {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.pf-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
  background: var(--surface-success-soft);
  color: var(--status-success);
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 1.4rem;
}

.pf-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pf-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.pf-field {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
}

.pf-field label {
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

/* PrimeVue InputText & Textarea alineados a los tokens */
.pf-field :deep(.p-inputtext),
.pf-field :deep(.p-textarea) {
  background: color-mix(in srgb, var(--bg-card) 80%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  box-shadow: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.pf-field :deep(.p-inputtext:focus),
.pf-field :deep(.p-textarea:focus) {
  border-color: var(--primary-green);
  box-shadow: var(--focus-ring);
}

.pf-select {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-card) 80%, transparent);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.pf-select:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: var(--focus-ring);
}

.pf-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.pf-hint {
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  color: var(--text-tertiary);
}

.pf-error {
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  color: var(--status-critical);
}

.pf-server-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  background: var(--surface-danger-soft);
  border: 1px solid color-mix(in srgb, var(--status-critical) 25%, transparent);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: var(--font-weight-medium);
  color: var(--status-critical);
}

.pf-divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 0.2rem 0;
}

.pf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  transition: background 0.18s, transform 0.15s;
}

.btn-ghost:hover {
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-full);
  color: #fff;
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  box-shadow: var(--shadow-green);
  transition: transform 0.18s, box-shadow 0.18s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-green);
}

@media (max-width: 540px) {
  .pf-row {
    grid-template-columns: 1fr;
  }

  .pf-card {
    padding: 1.4rem 1.1rem;
  }
}
</style>

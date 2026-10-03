<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../../auth/store/authStore';
import { useProfileStore } from '../application/profile.store';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useI18n } from 'vue-i18n';

interface Stats {
  label: string;
  value: string | number;
  icon: string;
}

const authStore = useAuthStore();
const profileStore = useProfileStore();
const { t, locale } = useI18n();

const isEditing = ref(false);
const formData = ref({
  fullName: '',
  phone: '',
  bio: '',
  location: ''
});

const avatarFile = ref<File | null>(null);

const fullName = computed(() => {
  const p = profileStore.profile;
  if (!p) return t('auth.authMenu.guest');
  return p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || p.username || t('auth.authMenu.guest');
});
const email = computed(() => profileStore.profile?.email || authStore.userEmail || '');
const phone = computed(() => profileStore.profile?.phone || '');
const bio = computed(() => profileStore.profile?.bio || '');
const location = computed(() => profileStore.profile?.location || '');
const joinDate = computed(() => {
  if (profileStore.profile?.joinDate) {
    return new Date(profileStore.profile.joinDate).toLocaleDateString(locale.value);
  }
  return '';
});

const avatarPreview = computed(() => profileStore.profile?.avatarUrl || null);

const avatarInitials = computed(() => {
  return fullName.value.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
});

const stats = computed<Stats[]>(() => {
  if (!profileStore.profile?.stats) {
    return [
      { icon: '🌱', value: 0, label: t('profile.stats.totalPlants') },
      { icon: '💧', value: 0, label: t('profile.stats.wateringSessions') },
      { icon: '📅', value: '', label: t('profile.stats.memberSince') },
      { icon: '✅', value: '0%', label: t('profile.stats.successRate') },
    ];
  }
  return [
    { icon: '🌱', value: profileStore.profile.stats.totalPlants || 0, label: t('profile.stats.totalPlants') },
    { icon: '💧', value: profileStore.profile.stats.wateringSessions || 0, label: t('profile.stats.wateringSessions') },
    { icon: '📅', value: joinDate.value, label: t('profile.stats.memberSince') },
    { icon: '✅', value: `${profileStore.profile.stats.successRate ?? 0}%`, label: t('profile.stats.successRate') },
  ];
});

const recentAchievements = computed(() => {
  return profileStore.achievements
    .filter(a => a.status === 'unlocked' && !a.featured)
    .map(a => ({
      icon: a.icon || '🏆',
      title: a.titleKey ? t(a.titleKey) : a.title,
      description: a.descKey ? t(a.descKey) : a.description,
      date: a.earnedDate ? new Date(a.earnedDate).toLocaleDateString(locale.value) : '—',
      status: a.status
    }));
});

// Insignia destacada "Cuidador Experto" (Hipótesis 5).
const expertBadge = computed(() => {
  const badge = profileStore.achievements.find(a => a.featured);
  if (!badge) return null;
  return {
    title: badge.titleKey ? t(badge.titleKey) : badge.title,
    description: badge.descKey ? t(badge.descKey) : badge.description,
    icon: badge.icon || '🏆',
    unlocked: badge.status === 'unlocked',
    progress: badge.progress ?? 0,
    streakDays: Math.round((badge.progress ?? 0) * 7),
    date: badge.earnedDate ? new Date(badge.earnedDate).toLocaleDateString(locale.value) : null,
  };
});

watch(
  () => authStore.isSignedIn,
  (isReady) => {
    if (isReady) {
      profileStore.fetchProfile();
      profileStore.fetchAchievements();
    } else {
      profileStore.$reset();
    }
  },
  { immediate: false }
);

onMounted(async () => {
  if (authStore.isSignedIn) {
    profileStore.fetchProfile();
    profileStore.fetchAchievements();
  }
});

const handleEdit = () => {
  formData.value = {
    fullName: profileStore.profile?.fullName || '',
    phone: profileStore.profile?.phone || '',
    bio: profileStore.profile?.bio || '',
    location: profileStore.profile?.location || ''
  };
  isEditing.value = true;
};

const handleSave = async () => {
  try {
    await profileStore.updateProfile(formData.value);
    isEditing.value = false;
  } catch {
    // Store exposes the user-facing error state.
  }
};

const handleCancel = () => {
  isEditing.value = false;
};

const handleChangeAvatar = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png';
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      avatarFile.value = file;
      try {
        await profileStore.uploadAvatar(file);
      } catch {
        // Store exposes the user-facing error state.
      }
    }
  };
  input.click();
};
</script>

<template>
  <div class="pp-wrap">
    <!-- Loading -->
    <div v-if="profileStore.loading" class="pp-loading">
      <div class="pp-loading-core">
        <i class="pi pi-spin pi-spinner pp-loading-icon"></i>
      </div>
      <h2>{{ t('profile.loading') }}</h2>
    </div>

    <!-- Error -->
    <div v-else-if="profileStore.error" class="pp-error-state">
      <i class="pi pi-exclamation-circle"></i>
      {{ t('profile.error', { error: profileStore.error }) }}
    </div>

    <div v-else class="pp-content">
      <!-- ── Main profile card ── -->
      <div class="glass-card">
        <div class="pp-header">
          <!-- Avatar -->
          <div class="pp-avatar-col">
            <div class="pp-avatar-wrap">
              <img v-if="avatarPreview" :src="avatarPreview" :alt="fullName" class="pp-avatar-img" />
              <div v-else class="pp-avatar-initials">{{ avatarInitials }}</div>
            </div>
            <button class="pp-change-photo" @click="handleChangeAvatar">{{ t('profile.changePhoto') }}</button>
          </div>

          <!-- Info -->
          <div class="pp-header-info">
            <p class="pp-eyebrow">{{ t('profile.eyebrow') }}</p>
            <h1 class="pp-name">{{ fullName }}</h1>
            <p class="pp-meta">{{ location || t('profile.noLocation') }} • {{ t('profile.joined') }} {{ joinDate || '—' }}</p>
            <p class="pp-bio">{{ bio || t('profile.noBio') }}</p>
          </div>

          <!-- Action -->
          <div class="pp-header-action">
            <Button
              v-if="!isEditing"
              class="pp-edit-btn"
              @click="handleEdit"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
              {{ t('profile.editProfile') }}
            </Button>
          </div>
        </div>

        <!-- Stats -->
        <div class="pp-stats">
          <div v-for="(stat, i) in stats" :key="i" class="pp-stat">
            <div class="pp-stat-icon">{{ stat.icon }}</div>
            <div class="pp-stat-val">{{ stat.value }}</div>
            <div class="pp-stat-lbl">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <!-- ── Two-column section ── -->
      <div class="pp-cols">
        <!-- Personal Information -->
        <div class="glass-card">
          <p class="pp-section-eye">{{ t('profile.section.account') }}</p>
          <h2 class="pp-section-title">{{ t('profile.section.personalInfo') }}</h2>

          <span class="pp-status-chip">
            <i class="pi pi-leaf"></i>
            {{ t('profile.status.activeProfile') }}
          </span>

          <!-- View mode -->
          <div v-if="!isEditing" class="pp-info-grid">
            <div class="pp-info-item">
              <span class="pp-info-lbl">{{ t('profile.info.email') }}</span>
              <span class="pp-info-val">{{ email || '—' }}</span>
            </div>
            <div class="pp-info-item">
              <span class="pp-info-lbl">{{ t('profile.info.phone') }}</span>
              <span class="pp-info-val">{{ phone || '—' }}</span>
            </div>
            <div class="pp-info-item">
              <span class="pp-info-lbl">{{ t('profile.info.location') }}</span>
              <span class="pp-info-val">{{ location || '—' }}</span>
            </div>
            <div class="pp-info-item">
              <span class="pp-info-lbl">{{ t('profile.info.memberSince') }}</span>
              <span class="pp-info-val">{{ joinDate || '—' }}</span>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="pp-form">
            <div class="pp-field">
              <label>{{ t('profile.form.fullName') }}</label>
              <InputText v-model="formData.fullName" :placeholder="t('profile.form.fullNamePlaceholder')" />
            </div>
            <div class="pp-field">
              <label>{{ t('profile.form.email') }}</label>
              <InputText :value="email" type="email" disabled />
            </div>
            <div class="pp-field">
              <label>{{ t('profile.form.phone') }}</label>
              <InputText v-model="formData.phone" type="tel" :placeholder="t('profile.form.phonePlaceholder')" />
            </div>
            <div class="pp-field">
              <label>{{ t('profile.form.location') }}</label>
              <InputText v-model="formData.location" :placeholder="t('profile.form.locationPlaceholder')" />
            </div>
            <div class="pp-field">
              <label>{{ t('profile.form.bio') }}</label>
              <Textarea v-model="formData.bio" rows="3" :placeholder="t('profile.form.bioPlaceholder')" />
            </div>
            <div class="pp-form-actions">
              <Button class="btn-ghost" type="button" @click="handleCancel">{{ t('profile.form.cancel') }}</Button>
              <Button class="btn-primary" type="button" :loading="profileStore.loading" @click="handleSave">
                {{ t('profile.form.saveChanges') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Achievements -->
        <div class="glass-card">
          <p class="pp-section-eye">{{ t('profile.section.milestones') }}</p>
          <h2 class="pp-section-title">{{ t('profile.section.achievements') }}</h2>

          <!-- Insignia destacada: Cuidador Experto (Hipótesis 5) -->
          <div
            v-if="expertBadge"
            class="pp-expert"
            :class="{ 'pp-expert--locked': !expertBadge.unlocked }"
          >
            <div class="pp-expert-icon">{{ expertBadge.icon }}</div>
            <div class="pp-expert-body">
              <p class="pp-expert-title">{{ expertBadge.title }}</p>
              <p class="pp-expert-desc">{{ expertBadge.description }}</p>

              <p v-if="expertBadge.unlocked && expertBadge.date" class="pp-expert-meta">
                {{ t('profile.expertBadge.earnedOn', { date: expertBadge.date }) }}
              </p>
              <template v-else>
                <div class="pp-expert-progress">
                  <div class="pp-expert-progress__bar" :style="{ width: `${expertBadge.progress * 100}%` }"></div>
                </div>
                <p class="pp-expert-meta">
                  {{ t('profile.expertBadge.progress', { days: expertBadge.streakDays }) }} ·
                  {{ t('profile.expertBadge.lockedHint') }}
                </p>
              </template>
            </div>
          </div>

          <div v-if="recentAchievements.length > 0" class="pp-ach-list">
            <div
              v-for="(ach, i) in recentAchievements"
              :key="i"
              class="pp-ach"
              :class="{ 'pp-ach--locked': ach.status === 'locked' }"
            >
              <div class="pp-ach-icon">
                <i v-if="ach.icon && ach.icon.startsWith('pi')" :class="ach.icon"></i>
                <span v-else>{{ ach.icon }}</span>
              </div>
              <div class="pp-ach-body">
                <p class="pp-ach-title">{{ ach.title }}</p>
                <p class="pp-ach-desc">{{ ach.description }}</p>
              </div>
              <span class="pp-ach-date">{{ ach.date }}</span>
            </div>
          </div>

          <div v-else-if="!expertBadge" class="pp-empty">
            <p>{{ t('profile.emptyAchievements') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pp-wrap {
  max-width: 1100px;
  margin: 1.5rem auto;
  padding: 0 1rem 2rem;
  color: var(--text-primary);
  position: relative;
  isolation: isolate;
}

.pp-wrap::before,
.pp-wrap::after {
  content: '';
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(52px);
  opacity: 0.32;
  z-index: -1;
  pointer-events: none;
}

.pp-wrap::before {
  width: 300px;
  height: 300px;
  top: 80px;
  right: -70px;
  background: var(--primary-green-light);
}

.pp-wrap::after {
  width: 240px;
  height: 240px;
  left: -60px;
  bottom: 60px;
  background: var(--surface-info-soft);
}

/* Glass card (hereda la receta global .glass-card de style.css) */
.glass-card {
  padding: 1.75rem;
}

/* Layout */
.pp-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pp-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Loading / Error states */
.pp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 3rem 1rem;
  border-radius: var(--radius-xl);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  text-align: center;
}

.pp-loading-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.pp-loading-icon {
  font-size: 1.6rem;
  color: var(--primary-green);
}

.pp-loading h2 {
  margin: 0;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
}

.pp-error-state {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  background: var(--surface-danger-soft);
  border: 1px solid color-mix(in srgb, var(--status-critical) 25%, transparent);
  border-radius: var(--radius-lg);
  color: var(--status-critical);
  font-size: 0.88rem;
  font-weight: var(--font-weight-medium);
}

/* Header */
.pp-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1.4rem;
  align-items: start;
  margin-bottom: 1.5rem;
  padding-bottom: 1.4rem;
  border-bottom: 1px solid var(--border-color);
}

.pp-avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
}

.pp-avatar-wrap {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-green);
}

.pp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pp-avatar-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  color: #fff;
}

.pp-change-photo {
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary-green);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.pp-eyebrow {
  margin: 0 0 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--primary-green);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
}

.pp-name {
  margin: 0 0 0.3rem;
  color: var(--text-primary);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.pp-meta {
  font-size: 0.85rem;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  margin-bottom: 0.55rem;
}

.pp-bio {
  font-size: 0.92rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.55;
  color: var(--text-secondary);
}

/* Edit button */
.pp-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-full);
  padding: 0.58rem 1.2rem;
  font-size: 0.76rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #fff;
  box-shadow: var(--shadow-green);
  transition: transform 0.18s, box-shadow 0.18s;
}

.pp-edit-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-green);
}

/* Stats */
.pp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
}

.pp-stat {
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem 0.75rem;
  text-align: center;
  transition: border-color 0.18s, transform 0.18s;
}

.pp-stat:hover {
  border-color: var(--primary-green);
  transform: translateY(-2px);
}

.pp-stat-icon { font-size: 1.6rem; margin-bottom: 0.4rem; }
.pp-stat-val {
  font-size: 1.3rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
  color: var(--text-primary);
}
.pp-stat-lbl {
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

/* Section headers */
.pp-section-eye {
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--primary-green);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  margin-bottom: 0.25rem;
}

.pp-section-title {
  font-size: 1.1rem;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

/* Status chip */
.pp-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
  background: var(--surface-success-soft);
  color: var(--status-success);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 1.1rem;
}

/* Info grid */
.pp-info-grid { display: flex; flex-direction: column; gap: 0.85rem; }
.pp-info-item { display: flex; flex-direction: column; gap: 0.2rem; }
.pp-info-lbl {
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}
.pp-info-val {
  font-size: 0.92rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  color: var(--text-primary);
}

/* Form (edit mode) */
.pp-form { display: flex; flex-direction: column; gap: 0.9rem; }

.pp-field { display: flex; flex-direction: column; gap: 0.35rem; }

.pp-field label {
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.pp-field :deep(.p-inputtext),
.pp-field :deep(.p-textarea) {
  background: color-mix(in srgb, var(--bg-card) 80%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  box-shadow: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.pp-field :deep(.p-inputtext:focus),
.pp-field :deep(.p-textarea:focus) {
  border-color: var(--primary-green);
  box-shadow: var(--focus-ring);
}

.pp-field :deep(.p-inputtext:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.pp-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  margin-top: 0.4rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-color);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.btn-primary {
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-full);
  color: #fff;
  font-size: 0.76rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  box-shadow: var(--shadow-green);
}

/* Achievements */
/* ── Insignia destacada: Cuidador Experto ── */
.pp-expert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  border-radius: var(--radius-lg);
  background: var(--surface-warning-soft);
  border: 1px solid color-mix(in srgb, var(--status-warning) 45%, transparent);
  box-shadow: var(--shadow-sm);
}

.pp-expert--locked {
  background: color-mix(in srgb, var(--bg-secondary) 55%, transparent);
  border-color: var(--border-color);
  box-shadow: none;
  filter: grayscale(0.4);
}

.pp-expert-icon {
  font-size: 2.4rem;
  line-height: 1;
  flex-shrink: 0;
}
.pp-expert--locked .pp-expert-icon { opacity: 0.55; }

.pp-expert-body { flex: 1; min-width: 0; }

.pp-expert-title {
  font-weight: var(--font-weight-bold);
  font-size: 1.02rem;
  color: var(--text-primary);
  margin: 0 0 2px;
}

.pp-expert-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
}

.pp-expert-meta {
  font-size: 0.74rem;
  color: var(--text-secondary);
  margin: 6px 0 0;
}

.pp-expert-progress {
  margin-top: 8px;
  height: 6px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-primary) 12%, transparent);
  overflow: hidden;
}
.pp-expert-progress__bar {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--primary-green);
  transition: width 0.4s ease;
}

.pp-ach-list { display: flex; flex-direction: column; gap: 0.75rem; }

.pp-ach {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.9rem;
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: border-color 0.18s, transform 0.15s;
}

.pp-ach:hover {
  border-color: var(--primary-green);
  transform: translateY(-1px);
}

.pp-ach--locked { opacity: 0.5; filter: grayscale(0.4); }

.pp-ach-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--surface-success-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.pp-ach-body { flex: 1; }
.pp-ach-title {
  font-size: 0.88rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  color: var(--text-primary);
  margin-bottom: 0.15rem;
}
.pp-ach-desc {
  font-size: 0.78rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  color: var(--text-secondary);
}
.pp-ach-date {
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* Empty state */
.pp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: var(--text-secondary);
  font-size: 0.92rem;
  font-weight: var(--font-weight-medium);
  text-align: center;
}

/* Responsive */
@media (max-width: 992px) {
  .pp-cols { grid-template-columns: 1fr; }
  .pp-stats { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .pp-header { grid-template-columns: 1fr; text-align: center; }
  .pp-avatar-col { justify-self: center; }
  .pp-header-action { justify-self: center; }
  .pp-meta, .pp-bio { text-align: center; }
}
</style>

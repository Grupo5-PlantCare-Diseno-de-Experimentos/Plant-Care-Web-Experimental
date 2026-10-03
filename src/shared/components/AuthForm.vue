<template>
  <form @submit.prevent="handleSubmit" class="auth-form">
    <div class="form-group">
      <label for="email">{{ t('auth.form.email') }}</label>
      <input 
        id="email" 
        type="email" 
        v-model="email" 
        required 
        :placeholder="t('auth.form.emailPlaceholder')" 
      />
    </div>
    <div class="form-group">
      <label for="password">{{ t('auth.form.password') }}</label>
      <input 
        id="password" 
        type="password" 
        v-model="password" 
        required 
        :placeholder="t('auth.form.passwordPlaceholder')" 
      />
    </div>
    <button type="submit" class="submit-btn" :disabled="isLoading">
      {{ isLoading ? t('auth.form.loading') : t('auth.form.submit') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { isLoading } = defineProps<{
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit-login', payload: { email: string; password: string }): void
}>();

const email = ref('');
const password = ref('');
const { t } = useI18n();

const handleSubmit = () => {
  if (!email.value.trim() || !password.value.trim()) return;
  emit('submit-login', { email: email.value, password: password.value });
};
</script>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 400px;
  width: 100%;
  margin: 0 auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

input {
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-card) 78%, transparent);
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-family: inherit;
  color: var(--text-primary);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input::placeholder {
  color: var(--text-tertiary);
}

input:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: var(--focus-ring);
}

.submit-btn {
  padding: 0.875rem;
  background: var(--gradient-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  font-size: 1rem;
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  box-shadow: var(--shadow-green);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast);
}

.submit-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.submit-btn:disabled {
  background: var(--border-color);
  color: var(--text-secondary);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
  filter: none;
}
</style>

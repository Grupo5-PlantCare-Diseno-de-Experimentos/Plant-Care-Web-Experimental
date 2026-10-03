<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from "../store/authStore";
import { useRouter } from 'vue-router';
import logo from '../../assets/pc_logo.png'
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const email = ref<string>("");
const password = ref<string>("");
const confirmPassword = ref<string>("");
const submitted = ref<boolean>(false);
const errorMessage = ref<string>("");
const isLoading = ref<boolean>(false);
let lastSubmitAttempt = 0;

const authenticationStore = useAuthStore();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validatePassword(password: string): { isValid: boolean; strength: string; issues: string[] } {
  const issues: string[] = [];
  
  if (password.length < 8) issues.push(t('auth.signup.requirements.minLength'));
  if (!/[a-z]/.test(password)) issues.push(t('auth.signup.requirements.lowercase'));
  if (!/[A-Z]/.test(password)) issues.push(t('auth.signup.requirements.uppercase'));
  if (!/[0-9]/.test(password)) issues.push(t('auth.signup.requirements.number'));
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) issues.push(t('auth.signup.requirements.symbol'));

  let strength = t('auth.signup.strengthWeak');
  if (issues.length <= 2) strength = t('auth.signup.strengthStrong');
  else if (issues.length <= 3) strength = t('auth.signup.strengthGood');

  return {
    isValid: issues.length === 0,
    strength,
    issues
  };
}

function sanitizeInput(input: string): string {
  return input.trim().slice(0, 254);
}

const passwordStrength = computed(() => {
  if (!password.value) return { isValid: true, strength: '', issues: [] };
  return validatePassword(password.value);
});

const passwordMatch = computed(() => {
  if (!confirmPassword.value) return null;
  return password.value === confirmPassword.value;
});

async function onSignUp(): Promise<void> {
  submitted.value = true;
  errorMessage.value = "";

  const now = Date.now();
  if (now - lastSubmitAttempt < 2000) {
    errorMessage.value = t('auth.signup.waitBeforeRetry');
    return;
  }
  lastSubmitAttempt = now;

  const sanitizedEmail = sanitizeInput(email.value).toLowerCase();
  const sanitizedPassword = password.value;

  if (!sanitizedEmail || !sanitizedPassword || !confirmPassword.value) {
    errorMessage.value = t('auth.signup.allFieldsRequired');
    return;
  }

  if (!validateEmail(sanitizedEmail)) {
    errorMessage.value = t('auth.signup.invalidEmail');
    return;
  }

  const passwordValidation = validatePassword(sanitizedPassword);
  if (!passwordValidation.isValid) {
    errorMessage.value = t('auth.signup.passwordMustInclude', { issues: passwordValidation.issues.join(', ') });
    return;
  }

  if (sanitizedPassword !== confirmPassword.value) {
    errorMessage.value = t('auth.signup.passwordMismatch');
    return;
  }

  isLoading.value = true;
  try {
    await authenticationStore.signUp(sanitizedEmail, sanitizedPassword);
    
    email.value = "";
    password.value = "";
    confirmPassword.value = "";

    if (!authenticationStore.isSignedIn) {
      toast.add({
        severity: 'info',
        summary: t('auth.signup.toast.checkInbox'),
        detail: t('auth.signup.toast.accountCreated'),
        life: 8000
      });
      setTimeout(() => router.push('/sign-in'), 4000);
    } else {
      toast.add({ severity: 'success', summary: t('auth.signup.toast.success'), detail: t('auth.signup.toast.redirectSetup'), life: 3000 });
      setTimeout(() => router.push('/complete-profile'), 2000);
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    
    let displayError = t('auth.signup.registrationFailed');
    
    if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already exists') || error.message?.toLowerCase().includes('user already')) {
      displayError = t('auth.signup.emailRegistered');
    } else if (error.message?.toLowerCase().includes('invalid')) {
      displayError = t('auth.signup.invalidEmailFormat');
    }
    
    errorMessage.value = displayError;
    toast.add({ severity: 'error', summary: t('auth.signup.toast.error'), detail: displayError, life: 4000 });
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="container">
    <div class="bg-orbit bg-orbit-1"></div>
    <div class="bg-orbit bg-orbit-2"></div>
    <div class="bg-grid"></div>

    <div class="signup-card">
      <div class="signup-header">
        <div class="logo-ring">
          <img :src="logo" :alt="t('common.logoAlt')" class="logo-image">
        </div>
        <div class="eyebrow">{{ t('auth.signup.eyebrow') }}</div>
        <h2 class="title">{{ t('auth.signup.title') }}</h2>
        <p class="subtitle">{{ t('auth.signup.subtitle') }}</p>
      </div>

      <form @submit.prevent="onSignUp" class="form-layout">
        <div class="form-group">
          <label for="email" class="form-label">{{ t('auth.signup.emailLabel') }}</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            :placeholder="t('auth.signup.emailPlaceholder')"
            :class="{'p-invalid': submitted && !email}"
            :disabled="isLoading"
          />
          <small v-if="submitted && !email" class="form-error">{{ t('auth.signup.emailRequired') }}</small>
          <small v-if="submitted && email && !validateEmail(email)" class="form-error">{{ t('auth.signup.emailInvalid') }}</small>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">{{ t('auth.signup.passwordLabel') }}</label>
          <InputText
            id="password"
            v-model="password"
            type="password"
            :placeholder="t('auth.signup.passwordPlaceholder')"
            :class="{'p-invalid': submitted && password && !passwordStrength.isValid}"
            :disabled="isLoading"
          />
          <div v-if="password" class="password-strength">
            <div class="strength-indicator">
              <div
                :class="['strength-bar', {
                  'strength-weak': passwordStrength.strength === 'Weak',
                  'strength-good': passwordStrength.strength === 'Good',
                  'strength-strong': passwordStrength.strength === 'Strong'
                }]"
              ></div>
              <span class="strength-text">
                {{ t('auth.signup.strengthLabel') }}: <strong>{{ passwordStrength.strength }}</strong>
              </span>
            </div>
            <div v-if="passwordStrength.issues.length > 0" class="requirements">
              <p class="requirements-label">{{ t('auth.signup.missing') }}</p>
              <ul>
                <li v-for="issue in passwordStrength.issues" :key="issue">
                  {{ issue }}
                </li>
              </ul>
            </div>
            <div v-else class="requirements-met">
              ✓ {{ t('auth.signup.requirementsMet') }}
            </div>
          </div>
          <small v-if="submitted && !password" class="form-error">{{ t('auth.signup.passwordRequired') }}</small>
          <small v-if="submitted && password && !passwordStrength.isValid" class="form-error">
            {{ t('auth.signup.passwordInvalid', { issues: passwordStrength.issues.join(', ') }) }}
          </small>
        </div>

        <div class="form-group">
          <label for="confirmPassword" class="form-label">{{ t('auth.signup.confirmLabel') }}</label>
          <InputText
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            :placeholder="t('auth.signup.confirmPlaceholder')"
            :class="{'p-invalid': submitted && confirmPassword && passwordMatch === false}"
            :disabled="isLoading"
          />
          <small v-if="submitted && !confirmPassword" class="form-error">{{ t('auth.signup.confirmRequired') }}</small>
          <small v-if="passwordMatch === false" class="form-error">{{ t('auth.signup.passwordMismatch') }}</small>
          <small v-else-if="passwordMatch === true" class="form-info">✓ {{ t('auth.signup.passwordsMatch') }}</small>
        </div>

        <div class="button-container">
          <Button class="btn-register" type="submit" :disabled="isLoading" :loading="isLoading">
            {{ isLoading ? t('auth.signup.creating') : t('auth.signup.register') }}
          </Button>
        </div>

        <div v-if="errorMessage" class="error-alert">
          {{ errorMessage }}
        </div>
      </form>

      <div class="navigation-section">
        <p class="navigation-text">{{ t('auth.signup.haveAccount') }}</p>
        <router-link to="/sign-in" class="signin-link">
          {{ t('auth.signup.signInHere') }}
        </router-link>
      </div>
    </div>

    <Toast />
  </div>
</template>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background:
    radial-gradient(circle at top left, var(--primary-green-light), transparent 30%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--primary-green) 12%, transparent), transparent 34%),
    linear-gradient(135deg, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-primary) 78%, var(--primary-green-light)) 100%);
  color: var(--text-primary);
}

.bg-orbit {
  position: absolute;
  border-radius: 999px;
  filter: blur(12px);
  pointer-events: none;
}

.bg-orbit-1 {
  width: 260px;
  height: 260px;
  top: -90px;
  left: -90px;
  background: color-mix(in srgb, var(--primary-green) 22%, transparent);
}

.bg-orbit-2 {
  width: 340px;
  height: 340px;
  right: -120px;
  bottom: -120px;
  background: var(--primary-green-light);
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--text-primary) 8%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 8%, transparent) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 88%);
  pointer-events: none;
}

.signup-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  padding: var(--spacing-xl);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--bg-card) 84%, transparent);
  border: 1px solid var(--border-color);
  box-shadow:
    var(--shadow-xl),
    inset 0 1px 0 color-mix(in srgb, var(--text-inverse) 50%, transparent);
  backdrop-filter: blur(18px);
}

.signup-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.8rem;
  text-align: center;
}

.logo-ring {
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-2xl);
  padding: 0.8rem;
  margin-bottom: 1rem;
  background: var(--primary-green-light);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.logo-image {
  max-width: 70px;
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.75rem;
  margin-bottom: 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-card) 74%, transparent);
  color: var(--primary-green);
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title {
  color: var(--text-primary);
  font-size: clamp(1.8rem, 3vw, 2.35rem);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.05em;
  margin-bottom: 0.45rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.96rem;
  line-height: 1.6;
}

.form-layout {
  display: grid;
  gap: 1.1rem;
}

.form-group {
  display: grid;
  gap: 0.55rem;
}

.form-label {
  display: block;
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.password-strength {
  margin-top: 0.35rem;
  padding: 0.95rem;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.strength-indicator {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 0.75rem;
}

.strength-bar {
  position: relative;
  width: 108px;
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--border-color);
}

.strength-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  width: 0;
  animation: fillBar 0.5s ease forwards;
}

.strength-bar.strength-weak::after {
  width: 33%;
  background: var(--status-critical);
}

.strength-bar.strength-good::after {
  width: 66%;
  background: var(--status-warning);
}

.strength-bar.strength-strong::after {
  width: 100%;
  background: var(--status-success);
}

@keyframes fillBar {
  from { width: 0; }
}

.strength-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.requirements {
  font-size: 0.86rem;
  color: var(--text-secondary);
}

.requirements-label {
  margin: 0 0 0.45rem 0;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.requirements ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.requirements li {
  color: var(--text-secondary);
}

.requirements li::before {
  content: '• ';
  color: var(--primary-green);
  font-weight: var(--font-weight-bold);
}

.requirements-met {
  font-size: 0.9rem;
  color: var(--status-success);
  font-weight: var(--font-weight-semibold);
}

:deep(.p-inputtext) {
  width: 100%;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-card) 78%, transparent);
  color: var(--text-primary);
  font-size: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

:deep(.p-inputtext::placeholder) {
  color: var(--text-tertiary);
}

:deep(.p-inputtext:focus) {
  border-color: var(--primary-green);
  background: var(--bg-card);
  box-shadow: var(--focus-ring);
  outline: none;
  transform: translateY(-1px);
}

:deep(.p-inputtext.p-invalid) {
  border-color: var(--status-critical);
  background: var(--surface-danger-soft);
}

.form-error {
  color: var(--status-critical);
  font-size: 0.84rem;
  margin-top: 0.1rem;
  display: block;
}

.form-info {
  color: var(--status-success);
  font-size: 0.84rem;
  margin-top: 0.1rem;
  display: block;
}

.button-container {
  display: flex;
  justify-content: stretch;
  margin-top: 0.3rem;
}

:deep(.btn-register) {
  width: 100%;
  border: none;
  border-radius: var(--radius-full);
  color: #fff;
  padding: 0.95rem 1.25rem;
  font-weight: var(--font-weight-bold);
  font-size: 1rem;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-green);
  transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
}

:deep(.btn-register:hover:not(:disabled)) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-green);
  filter: brightness(1.03);
}

:deep(.btn-register:disabled) {
  opacity: 0.75;
  cursor: not-allowed;
}

.error-alert {
  margin-top: 0.2rem;
  background: var(--surface-danger-soft);
  color: var(--status-critical);
  padding: 0.95rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--status-critical) 25%, transparent);
  font-size: 0.94rem;
  line-height: 1.5;
}

.navigation-section {
  margin-top: 1.5rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.navigation-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 0.7rem;
}

.signin-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
  text-decoration: none;
  padding: 0.8rem 1.1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-secondary) 40%, transparent);
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.signin-link:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 640px) {
  .container {
    padding: 0.9rem;
  }

  .signup-card {
    padding: 1.15rem;
    border-radius: var(--radius-xl);
  }

  .title {
    font-size: 1.55rem;
  }

  .logo-ring {
    width: 84px;
    height: 84px;
  }

  .logo-image {
    max-width: 60px;
  }

  .strength-indicator {
    flex-direction: column;
    align-items: flex-start;
  }

  .strength-bar {
    width: 100%;
  }
}
</style>
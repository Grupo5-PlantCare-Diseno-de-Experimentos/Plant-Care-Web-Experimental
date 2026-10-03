import { computed, readonly, ref } from 'vue';

export type ThemeMode = 'Light' | 'Dark' | 'System';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'app_theme';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'Light' || value === 'Dark' || value === 'System';
}

function resolveSystemTheme(): EffectiveTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const storedMode = localStorage.getItem(STORAGE_KEY);
const mode = ref<ThemeMode>(isThemeMode(storedMode) ? storedMode : 'System');
const effectiveTheme = ref<EffectiveTheme>('light');

let mediaQuery: MediaQueryList | null = null;

function applyTheme(): void {
  const effective = mode.value === 'System'
    ? resolveSystemTheme()
    : (mode.value.toLowerCase() as EffectiveTheme);
  effectiveTheme.value = effective;
  document.documentElement.setAttribute('data-theme', effective);
}

function watchSystemTheme(): void {
  if (mediaQuery || typeof window === 'undefined') return;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if (mode.value === 'System') applyTheme();
  });
}

/** Aplica el tema persistido antes de montar la app (evita flash de tema). */
export function initTheme(): void {
  watchSystemTheme();
  applyTheme();
}

export function useTheme() {
  watchSystemTheme();

  const isDark = computed(() => effectiveTheme.value === 'dark');

  function setMode(next: ThemeMode): void {
    mode.value = next;
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme();
  }

  function toggle(): void {
    setMode(effectiveTheme.value === 'dark' ? 'Light' : 'Dark');
  }

  return {
    mode: readonly(mode),
    effectiveTheme: readonly(effectiveTheme),
    isDark,
    setMode,
    toggle,
  };
}

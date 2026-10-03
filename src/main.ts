import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import App from "./App.vue";
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import 'primeicons/primeicons.css'
import './style.css'
import router from './router';
import { createPinia } from 'pinia';
import { i18n } from './i18n';
import { initTheme } from './shared/presentation/composables/useTheme';

// Preset único de la app: verde Apple + radios/superficies de los tokens globales.
const PlantCarePreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#eefaf1',
            100: '#d8f3e0',
            200: '#b4e7c3',
            300: '#85d69e',
            400: '#52c574',
            500: '#34c759',
            600: '#28a745',
            700: '#218838',
            800: '#1d6f30',
            900: '#195a2a',
            950: '#0b3115'
        },
        focusRing: {
            width: '3px',
            style: 'solid',
            color: 'rgba(52, 199, 89, 0.25)',
            offset: '0px'
        },
        borderRadius: {
            none: '0',
            xs: '4px',
            sm: '8px',
            md: '12px',
            lg: '18px',
            xl: '24px'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '{primary.500}',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.600}',
                    activeColor: '{primary.700}'
                },
                surface: {
                    0: '#ffffff',
                    50: '#f5f5f7',
                    100: '#ececee',
                    200: '#e0e0e3',
                    300: '#d2d2d7',
                    400: '#a1a1a6',
                    500: '#86868b',
                    600: '#636366',
                    700: '#48484a',
                    800: '#3a3a3c',
                    900: '#1d1d1f',
                    950: '#0d0d0f'
                }
            },
            dark: {
                primary: {
                    color: '{primary.500}',
                    contrastColor: '#0b3115',
                    hoverColor: '{primary.400}',
                    activeColor: '{primary.300}'
                },
                surface: {
                    0: '#000000',
                    50: '#0d0d0f',
                    100: '#1c1c1e',
                    200: '#2c2c2e',
                    300: '#3a3a3c',
                    400: '#48484a',
                    500: '#636366',
                    600: '#86868b',
                    700: '#a1a1a6',
                    800: '#d2d2d7',
                    900: '#f5f5f7',
                    950: '#ffffff'
                }
            }
        }
    }
});

// Crear la app
const app = createApp(App);

// Configurar PrimeVue (el tema oscuro sigue el atributo data-theme del documento)
app.use(PrimeVue, {
    theme: {
        preset: PlantCarePreset,
        options: {
            darkModeSelector: '[data-theme="dark"]',
            cssLayer: false
        }
    }
});

// Servicios globales
app.use(ToastService);
app.use(ConfirmationService);

// Configurar Pinia
const pinia = createPinia();
app.use(pinia);

// Configurar i18n
app.use(i18n);

// Usar router (registramos pero no montamos aún)
app.use(router);

// Inicializar store de autenticación y montar app
import { useAuthStore } from './auth/store/authStore';

const init = async () => {
    initTheme();
    const authStore = useAuthStore(pinia);
    try {
        await authStore.initialize();
    } catch (e) {
        console.warn('No se pudo inicializar el store de autenticación', e);
    }
    app.mount('#app');
};

init();

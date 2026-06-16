import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'


export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Aísla el módulo i18n en su propio chunk. Solo depende de vue-i18n
          // (vendor), por lo que queda como hoja del grafo y nunca forma un
          // ciclo entre chunks: garantiza que su export `i18n` esté inicializado
          // antes de que cualquier consumidor lo use.
          if (id.includes('/src/i18n')) {
            return 'i18n';
          }
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router')) {
              return 'vue-vendor';
            }
            if (id.includes('primevue') || id.includes('primeicons')) {
              return 'primevue-vendor';
            }
            if (id.includes('pinia')) {
              return 'pinia-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  },
 
});
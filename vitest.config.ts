import { defaultExclude, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    // Los E2E de Playwright viven en e2e/ y los ejecuta `npm run e2e`, no Vitest.
    exclude: [...defaultExclude, 'e2e/**']
  }
})

# AGENTS.md — Guía para agentes IA en PlantCare Web

> Fuente de verdad: código real en `Plant-Care-Web-Experimental/`. No inventar tecnologías, carpetas, comandos ni convenciones fuera de lo aquí descrito. Si algo no existe en el repo, no asumirlo.

## 1. Descripción general del proyecto

**PlantCare Web – Frontend (Vue.js)** (`name: plantcare`, `private: true`, `version: 0.0.0`, `type: module`).

SPA para gestión inteligente de plantas con IoT, analíticas e interacción comunitaria. Permite:

- Ver estado de plantas conectadas a dispositivos IoT (`plant_metrics`: `air_humidity_pct`, `temperature_c`, `soil_moisture_pct`, `light_level`, `device_id`).
- Gestionar plantas, riegos (`watering_logs`) y métricas desde dashboard.
- Autenticación con sesión persistente (Supabase Auth + espejo de token en `sessionStorage`).
- Analíticas, perfil con gamificación/logros, experimentos (`tracking`, `discord`, `premium`, `cache`).

Entry points reales: `index.html` → `/src/main.ts` → `src/App.vue` → `src/router.ts`. Despliegue SPA con fallback en `vercel.json` (`{source: "/(.*)", destination: "/index.html"}`).

## 2. Stack tecnológico detectado (versiones exactas de `package.json`)

- **Framework:** `vue ^3.5.22` + `@vitejs/plugin-vue ^6.0.1`, SFC `<script setup lang="ts">`.
- **UI:** `primevue ^4.4.0` + `@primeuix/themes ^1.2.5` (preset `Aura` en `src/main.ts:2-3,17-21`), `primeicons ^7.0.0`, `ToastService` + `ConfirmationService` globales.
- **Lenguaje:** `typescript ~5.9.3` + `vue-tsc ^3.1.0`.
- **Build/dev:** `vite` resuelto por override a `npm:rolldown-vite@7.1.14` (`overrides` + `devDependencies` idénticos).
- **Router:** `vue-router ^4.5.1` (`createWebHistory` en `src/router.ts`).
- **Estado:** `pinia ^3.0.3` (`createPinia()` en `src/main.ts:28-29`).
- **i18n:** `vue-i18n ^11.4.0` (`src/i18n.ts`: `legacy:false`, `locale` desde `localStorage app_language`, `fallbackLocale: en`, ~1300 líneas `es/en`).
- **Backend/BaaS:** `@supabase/supabase-js ^2.116.0` (único cliente real). `firebase ^12.6.0` solo inicializado en `src/firebase.ts`, no se usa para auth en stores.
- **Observabilidad:** `@vercel/analytics ^2.0.1`, `@vercel/speed-insights ^2.0.0` (`injectSpeedInsights()` en `src/App.vue`).
- **Testing:** `vitest ^5.0.2`, `jsdom ^24.1.3`, `@vue/test-utils ^2.4.9`.
- **Mock legacy:** `json-server ^1.0.0-beta.3` + `db.json` (`users`, `plants`). Sin script activo, no usar en prod.
- **Cookies:** `js-cookie ^3.0.5` + `@types/js-cookie` instaladas pero sin uso detectado en `src/` principal.

> Aviso: `README.md` menciona `Axios`, pero **no está** en `package.json`. No usar Axios. No hay `fetch`/REST propio: toda persistencia es Supabase.

No existen (verificado): `eslint.config.*`, `.eslintrc*`, `prettier.config.*`, `.prettierrc*`, `playwright.config.*`, `.env.example`.

## 3. Arquitectura y estructura principal

Estilo: **Bounded Contexts por dominio + Clean/Hexagonal ligera por contexto**:

`domain/model/*.entity.ts` (tipos puros) → `application/*.store.ts` (Pinia) + helpers puros → `infrastructure/*.service.ts` + `assembler/*-assembler.ts` (mapeo snake_case Supabase → camelCase dominio) → `presentation/views|components|*-routes.ts`.

Estructura real (`src/`):

```text
src/
  App.vue, main.ts, router.ts, i18n.ts, firebase.ts, style.css, vite-env.d.ts
  auth/adapters/SupabaseAuthAdapter.ts, ports/IAuthService.ts, domain/{UserEntity.ts, AuthExceptions.ts},
    features/LoginUseCase.ts, services/supabase-auth.ts, store/{authStore.ts, authStoreFactory.ts},
    pages/{Login.vue, sign-up.component.vue}, components/{Authentication-Sector.vue, SupabaseAuth.vue}
  plants/application/{plants.store.ts, healthScore.ts, nextWatering.ts, plantAnalytics.ts, plantHealth.ts},
    domain/model/{plants.entity.ts, analytics.entity.ts},
    infrastructure/{plants.services.ts, watering-logs.service.ts, assambler/plants-assembler.ts},
    presentation/{plants-routes.ts, views/{Plants.vue, PlantDetail.vue, PlantsForm.vue, PlantsLayout.vue},
    components/{PlantAnalyticsView.vue, PlantHealthCard.vue, WateringScheduleCard.vue}}
  analytics/application/analytics.store.ts, domain/model/analytics.entity.ts,
    infrastructure/{analytics.service.ts, plants.service.ts, assembler/analytics-assembler.ts},
    presentation/{analytics-routes.ts, views/Analytics.vue, components/{AnalyticsHeader.vue, AnalyticsStatsGrid.vue, MetricAreaChart.vue}}
  profile/Components/{Profile.vue, CompleteProfile.vue}, application/profile.store.ts,
    infrastructure/profile.service.ts, model/profile.entity.ts
  shared/presentation/components/{Dashboard.vue, Header.vue, Sidebar.vue, Settings.vue},
    composables/useDashboard.ts, components/AuthForm.vue
  utils/supabase.ts
  experiments/{tracking/tracking.service.ts, discord/, premium/, gamification/expert-caretaker.ts, cache/metrics-cache.ts}
  assets/pc_logo*.png
```

Flujo de arranque (`src/main.ts`, 50 líneas): `createApp → PrimeVue(Aura) → ToastService → ConfirmationService → Pinia → i18n → router → useAuthStore(pinia).initialize() en try/catch con console.warn → mount('#app')`.

Router (`src/router.ts`, 136 líneas): `/→/dashboard`, `/login`, `/sign-in→/login`, `/sign-up`, `/complete-profile (requiresAuth+hideLayout)`, `/dashboard`, `/plants` anidado (`'' PlantsList`, `'new' PlantsForm`, `'edit/:id' PlantsForm con props`, `':id' PlantDetail`), `/analytics`, `/profile`, `/settings`, `/:pathMatch(.*)*→/dashboard`. `meta: {requiresAuth, hideLayout}`. `beforeEach` llama `authStore.initialize()`, valida `supabase.auth.getSession()` y que `access_token===authStore.token`, limpia token si inválida, redirige a `Login` o `Dashboard`.

Stores:

- `auth/store/authStoreFactory.ts`: factory `setupAuthStore(adapter, profileService)`; `authStore.ts` solo instancia con `SupabaseAuthAdapter` + `profileService`. Estado `user: UserEntity|null`, `token: sessionStorage token`, `isLoading`, `error`; getters `isSignedIn/userEmail/userId`.
- `plants/application/plants.store.ts`: `defineStore('plantManagement')` setup con `fetchPlants/addPlant/updatePlant/removePlant/setError/$reset`.
- `analytics/application/analytics.store.ts`: `defineStore('analytics')` options API (`state/getters/actions`: `initializeAnalytics/fetchAllSensorData/...`).
- `profile/application/profile.store.ts`: gamificación + `SEEN_ACHIEVEMENTS_KEY='pc:seenAchievements:'`.

Layout global (`src/App.vue`): `Sidebar + Header + router-view` con `transition fade`, `Toast top-right`, `mediaQuery max-width:1024px`, `watch isSignedIn→fetchAchievements`.

## 4. Convenciones de código existentes

- **Vue:** Composition API (`setup`, `ref/computed/watch/onMounted`), `useI18n(){t}`, lazy routes `()=>import(...)`. Pinia setup (`plants/profile/auth`) salvo `analytics` (options). No mezclar estilos sin motivo.
- **TS estricto real** (`tsconfig.app.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`. Patrones: `interface Metric/Plant/WateringLog`, `class UserEntity` readonly, `abstract class IAuthService`, `type PlantMetricRow=Record<string,unknown>`, helpers `toNullableNumber/String`, `error:unknown + instanceof Error`.
- **Deuda conocida:** `// @ts-ignore` en getters de `analytics.store.ts:78-133`. No añadir más; documentar si se toca.
- **Estilos:** `<style scoped>` por componente + global `src/style.css` (361 líneas, vars `--bg-primary/--primary-green:#34c759`, `data-theme="dark"`, `.glass`, fuente Inter). Sobrescritura PrimeVue (`.p-card/.p-dialog`).
- **Imports:** relativos (`../../utils/supabase`, `../domain/UserEntity`), a veces con extensión explícita (`from "../domain/model/plants.entity.ts"`, permitido por `allowImportingTsExtensions`). No hay alias `@`. Mantener relativo.
- **Idioma:** comentarios y esquema mixto ES/EN, UI con `t('...')`, ES por defecto, emojis en UI (`🌱💧🏆`).
- **Nombres (respetar tal cual, no renombrar sin pedirlo):** `PlantDetail.vue` PascalCase, pero excepciones reales `sign-up.component.vue`, `Authentication-Sector.vue`, `plants-routes.ts`, `plants.services.ts` (plural), `assambler/` (typo de `assembler`), `Components/` (mayúscula) vs `components/`, tests por autor en `pruebasUnitarias/{Juan,Ernesto,Enrique,Brayan}/`.

## 5. Reglas para crear o modificar archivos

1. Cambio mínimo necesario. No refactors grandes sin petición explícita.
2. Antes de modificar, leer los archivos relacionados (store + service + assembler + entity + view/componente + routes + test).
3. Reutilizar lo existente: stores, servicios, assemblers, `useDashboard.ts`, componentes PrimeVue ya usados, `t()` para textos.
4. Respetar capas: vista nunca llama Supabase directo; pasa por store → service → assembler → entity.
5. No duplicar lógica: si existe `computeNextWatering/computePlantHealth/toNullable*`, reutilizar.
6. Si hay varias formas, elegir la consistente con el archivo vecino.
7. Si ves mala práctica fuera del alcance, documéntala en el resumen, no cambies código extra.
8. Mantener compatibilidad con versiones de `package.json`. No romper `manualChunks` ni firmas de stores.

## 6. Reglas de nombres y organización

- Nuevas vistas en `*/presentation/views/`, componentes en `*/presentation/components/`, rutas en `*-routes.ts`, entidades en `*/domain/model/*.entity.ts`, lógica Pinia en `*/application/*.store.ts`, acceso Supabase en `*/infrastructure/*.service.ts`, mapeo en `*/assembler/*-assembler.ts`.
- No crear nuevas carpetas top-level en `src/` sin necesidad; usar el contexto existente (`auth/plants/analytics/profile/shared/experiments/utils`).
- Conservar typos/nombres existentes (`assambler/`, `sign-up.component.vue`, `Authentication-Sector.vue`) salvo que la tarea pida renombrar y se actualicen todos los imports + tests.
- Tests: unitarios junto a su dominio o en `tests/pruebasUnitarias/`, integrales en `tests/pruebasIntegrales/`, componentes shared en `tests/shared/`.

## 7. Buenas prácticas específicas del stack

- **Vue 3:** `<script setup lang="ts">`, `defineProps/defineEmits` tipados, `computed` para derivados, `watch` con cleanup, `onMounted` para fetch inicial.
- **Pinia:** setup style como `plants.store.ts` (`ref` + actions async + `$reset`); exponer `loading/error`; no mutar state ajeno directamente.
- **PrimeVue Aura:** usar componentes ya stubbeados en tests (`Button/InputText/Textarea/InputSwitch/Menu/ConfirmDialog/Toast/ProgressSpinner`). Si añades uno nuevo, añade su stub en `tests/setup.ts`.
- **vue-i18n:** todo texto UI vía `t('...')`; añadir claves en `es` y `en` en `src/i18n.ts`; no hardcodear strings visibles.
- **Supabase:** usar cliente de `src/utils/supabase.ts`; mapear snake_case→camelCase en assembler; usar `maybeSingle()` para perfiles ausentes; tolerar `404/PGRST116` vaciando arrays.
- **Vite:** no tocar `manualChunks` de `vite.config.ts` (aísla `i18n` para evitar ciclo). `base:'/'`.

## 8. Manejo de configuración y variables de entorno

- Solo 2 vars (verificado): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, leídas en `src/utils/supabase.ts:3-4` (y duplicado legacy `src/shared/infrastructure/supabase.js:3-4`). Si faltan lanzan `Error('Missing... Define ... in .env.local')`.
- Cliente Supabase: `auth:{storage: window.sessionStorage, autoRefreshToken:true, persistSession:true, detectSessionInUrl:true}`.
- `.env`, `.env.local`, `.env.production` están en `.gitignore:26-28`. Nunca commitear ni imprimir valores. No existe `.env.example`; si necesitas documentar, hazlo sin valores.
- Resto de config hardcodeada (`src/firebase.ts`, GSI Google en `index.html`). No mover a env sin pedirlo.

## 9. Reglas de seguridad

- Nunca exponer secretos, tokens, contraseñas o API keys en código, logs, tests o resúmenes.
- RLS Supabase por `auth.uid()=user_id/id` en `supabase_schema.sql`. No debilitar políticas; cualquier cambio SQL requiere revisión explícita.
- Guard router `requiresAuth` + validación doble (`authStore.user/token` + `supabase.auth.getSession()`). No bypassear.
- Token espejo en `sessionStorage token`. No migrar a `localStorage` sin pedirlo.
- Avatar: máx 2MB, solo `image/jpeg/png`, path `${userId}/${Date.now()}-rand.ext`, bucket `avatars` (ver `profile.service.ts`).
- Sign-up valida 8 chars + minúscula/mayúscula/número/símbolo (`src/i18n.ts`). Mantener.
- Discord webhook validado por URL. No loguear URLs de webhook.
- `firebase.ts:8-14` contiene `apiKey/projectId plant-care-ab02b` pública. No commitear claves nuevas; rotar solo en consola Firebase.

## 10. Manejo de errores

Patrón uniforme (stores/composables, ej. `plants.store.ts:12-23`, `authStoreFactory.ts:41-55`):

```ts
loading.value = true; error.value = null;
try { /* service */ } catch (e: unknown) {
  error.value = e instanceof Error ? e.message : 'fallback ES';
} finally { loading.value = false; }
```

- Dominio auth: `AuthExceptions.ts` (`InvalidCredentialsException`, `EmailNotConfirmedException` vía `message.includes('email not confirmed')`). Validadores `assertValidUserId/PlantId` lanzan `Error`.
- UI: `Toast/ConfirmDialog`, `console.warn/error` no bloqueantes (ej. `main.ts:45`).
- No tragar errores silenciosamente salvo el `beforeEach` del router (ya documentado como `noop` para no bloquear navegación).

## 11. Reglas para dependencias

- No instalar nuevas dependencias si se puede resolver con las existentes (PrimeVue, Pinia, vue-i18n, Supabase, `js-cookie` ya instalada).
- No añadir `axios`, `lodash`, `moment`, etc. sin justificación y aprobación.
- Respetar override `vite: npm:rolldown-vite@7.1.14`. No actualizar `vite/vue/typescript/pinia/supabase` fuera del rango `package.json`.
- Tras tocar `package.json`, usar `npm install` y verificar `package-lock.json` (194KB, no editar a mano).

## 12. Reglas para base de datos y APIs

- Única API: Supabase Postgres. Sin REST propio, sin Axios.
- Tablas en `supabase_schema.sql` (188 líneas): `profiles`, `plants`, `plant_metrics`, `watering_logs`, `premium_leads(plan_id,source_feature,simulated)`, `feature_interaction_logs(event_name,promotion_id,metadata,occurred_at)`, `user_achievements(user_id,achievement_id,unlocked_at UNIQUE)` + índices + trigger `handle_new_user()`.
- Servicios reales: `plants/infrastructure/plants.services.ts` (282 líneas, CRUD `plants+plant_metrics+watering_logs`, `waterPlant`, `ensureMetrics`, `mapToDomain`), `watering-logs.service.ts`, `analytics/infrastructure/*`, `profile/infrastructure/profile.service.ts` (360 líneas), `auth/adapters/SupabaseAuthAdapter.ts`.
- `db.json` es legacy para `json-server` (passwords en plano). No usar para nuevas features ni en prod.

## 13. Reglas para tests

- Framework real: Vitest + jsdom + `@vue/test-utils`. Config `vitest.config.ts` (`globals:true`, `setupFiles: ./tests/setup.ts`, `css:true`).
- Comandos únicos: `npm test` (watch), `npm run test:run` (CI). No hay `test:coverage`, `e2e`, `lint`.
- `tests/setup.ts` ya mockea `primevue/usetoast/useconfirm/vue-i18n` y stubbea `Button/InputText/Textarea/InputSwitch/Menu/RouterLink/RouterView/ConfirmDialog/Toast/ProgressSpinner` + `matchMedia` + limpia `sessionStorage` y `data-theme` en `afterEach`. Si usas un componente PrimeVue nuevo, actualiza stubs.
- Ubicación: `tests/App.spec.ts`, `tests/shared/*.spec.ts`, `tests/pruebasIntegrales/system-modules.integration.spec.ts`, `tests/pruebasUnitarias/*/*.spec.ts`. Nuevos tests junto a su contexto o en la carpeta correspondiente, nunca en raíz suelta.
- E2E Playwright en `e2e/` (`ai.spec.ts` + `helpers.ts` con mocks de Supabase/ai-chat; excluidos de Vitest vía `exclude` en `vitest.config.ts`). Config `playwright.config.ts` (solo Chromium, `webServer` vite en 5173). Usar `data-testid` en componentes nuevos y `page.route('**/functions/v1/ai-chat')` para mockear la IA.
- No dejar tests en skip/failing. Ejecutar `npm run test:run` tras cambios.

## 14. Comandos importantes del proyecto

```bash
npm install        # instalar deps (respeta package-lock.json)
npm run dev        # vite HMR
npm run build      # vue-tsc -b && vite build (gate de tipos + build)
npm run preview    # vite preview
npm test           # vitest watch
npm run test:run   # vitest run (CI)
npm run e2e:install # instala Chromium para Playwright (una vez)
npm run e2e        # playwright test (E2E Ai con mocks, sin backend real)
```

> `README.md` omite tests y cita Axios inexistente. No seguir README a ciegas; estos 5 comandos son los únicos soportados.

## 15. Reglas para build, lint y type checking

- No hay ESLint/Prettier. El único gate es `npm run build` (`vue-tsc -b` falla con `noUnusedLocals/noUnusedParameters/erasableSyntaxOnly/...`).
- No introducir imports sin uso, params sin uso, `any` innecesario ni `// @ts-ignore` nuevos.
- Tras cada cambio ejecutar en orden: `npm run test:run` → `npm run build`. Si `build` falla, corregir tipos antes de dar por terminado.
- No cambiar `tsconfig.*`, `vite.config.ts`, `vitest.config.ts` sin motivo y sin revalidar build + tests.

## 16. Reglas para evitar romper funcionalidades existentes

- No tocar el guard de `src/router.ts:97-134`, `authStore.initialize()`, `supabase.auth.getSession()`, ni el orden de `main.ts` sin entender el arranque.
- No cambiar `src/i18n.ts` (1306 líneas) salvo añadir claves ES+EN.
- No alterar `manualChunks`, assemblers ni entidades sin actualizar todos los consumidores.
- No unificar `src/utils/supabase.ts` vs `src/shared/infrastructure/supabase.js` sin verificar importadores (`grep` primero).
- Reutilizar `PlantsForm.vue` para `new` y `edit/:id` (así está diseñado).
- Revisar efectos en `Dashboard.vue`, `useDashboard.ts`, `Analytics.vue`, `Profile.vue` si tocas stores/servicios compartidos.

## 17. Archivos o carpetas que no deberían modificarse automáticamente

- `.env` (contiene `VITE_SUPABASE_URL` + `sb_publishable_*`), `.env.local`, `.env.production` — gitignorados, jamás sobrescribir/commitear.
- `.git/`, `package-lock.json` — no reescribir a mano.
- `src/firebase.ts:8-14` — keys hardcodeadas, solo rotar en consola.
- `supabase_schema.sql`, `agent/skills/`, `skills-lock.json`, `.agents/`, `.claude/` — RLS y hashes de skills; cambio rompe auth/tracking.
- `src/router.ts` guard, `src/i18n.ts`, `vite.config.ts`, `src/auth/store/*` — romper deja app en blanco.
- `public/pc_logo*.png` + `src/assets/pc_logo*.png` (duplicados intencionales), `dist/`, `node_modules/` (gitignorados) — no borrar.
- `db.json` — legacy, no migrar a prod sin petición.

## 18. Buenas prácticas de Git

- Cambios pequeños, claros y fáciles de revisar. Un concern por commit.
- Mensajes en imperativo y alcance (`feat(plants): ...`, `fix(auth): ...`, `test(analytics): ...`).
- No commitear `.env*`, `dist/`, `node_modules/`, `*.log`, `*.txt` (ver `.gitignore`).
- Verificar `git status/diff` antes de commitear; solo archivos intencionados. Nunca exponer secretos en diffs.
- No hacer pushforce, no reescribir historial ajeno.

## 19. Checklist antes de considerar una tarea terminada

- [ ] Leí los archivos relacionados (store/service/assembler/entity/view/routes/test).
- [ ] Reutilicé componentes/servicios/utils existentes, sin duplicar lógica.
- [ ] Textos UI vía `t()` con claves ES+EN si apliqué.
- [ ] `npm run test:run` en verde (o justifiqué por qué no aplica).
- [ ] `npm run build` en verde (`vue-tsc -b && vite build`).
- [ ] Sin `console.log` residual, sin `any`/`@ts-ignore` nuevos, sin imports sin uso.
- [ ] Sin secretos/tokens en código ni tests. `.env` intacto.
- [ ] Sin cambios fuera de alcance. Deuda nueva documentada en resumen.
- [ ] `git status/diff` revisado, solo archivos esperados.

## 20. Agent Workflow (flujo recomendado)

1. **Entender la tarea:** reformular objetivo, alcance y no-objetivos. Si es ambiguo, preguntar antes de codificar.
2. **Inspeccionar archivos relacionados:** leer store + service + assembler + entity + view + routes + `tests/setup.ts` + `i18n.ts` si hay UI.
3. **Identificar patrones existentes:** copiar el patrón del archivo vecino (error `loading/error`, mapeo assembler, stubs de test, `t()`).
4. **Diseñar el cambio mínimo:** listar archivos a tocar y por qué. Evitar nuevas deps/carpetas.
5. **Implementar:** cambios pequeños, tipados estrictos, sin secretos, con i18n ES/EN.
6. **Ejecutar validaciones:** `npm run test:run`, luego `npm run build`. Corregir hasta verde. Añadir/actualizar test si la lógica lo exige.
7. **Revisar efectos secundarios:** router guard, dashboard, analytics, perfil, chunks, RLS, stubs de test. `grep` de importadores si renombraste/moviste algo.
8. **Resumir cambios:** qué se tocó, por qué, validaciones ejecutadas, deuda detectada (sin arreglarla fuera de alcance).

## 21. Definition of Done

Un agente solo puede marcar terminada una tarea cuando:

- Cumple el objetivo pedido sin romper `dev/build/preview/test`.
- `npm run test:run` y `npm run build` pasan localmente.
- No hay secretos expuestos, ni archivos sensibles modificados, ni dependencias nuevas injustificadas.
- Código consistente con la arquitectura por contextos y convenciones de este repo.
- Tests relevantes existen o se actualizaron; textos UI están en ES+EN.
- Resumen entregado con archivos tocados, validaciones y riesgos/deuda.

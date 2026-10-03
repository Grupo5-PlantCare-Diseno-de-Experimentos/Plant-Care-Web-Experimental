# Despliegue del módulo Ai — Runbook

Activa el asistente con Gemini 2.5 Flash (capa gratuita) en el proyecto real.
Orden estricto. No commitear secretos en ningún paso (`.env*` está gitignorado).

## 0. Prerrequisitos

- [ ] Supabase CLI instalado y logueado: `supabase login`
- [ ] `project-ref` de tu proyecto (Dashboard → Project Settings → General)
- [ ] Gemini API key gratuita de Google AI Studio (`https://aistudio.google.com/apikey`)
- [ ] Este repo clonado con `supabase/functions/ai-chat/index.ts` y `supabase_ai_schema.sql`

> La app ya llama a la función vía `supabase.functions.invoke('ai-chat')`.
> `SUPABASE_URL` y `SUPABASE_ANON_KEY` los inyecta Supabase solo: no definirlos.

## 1. Tablas del historial (una vez)

En el SQL Editor del dashboard, pega y ejecuta **`supabase_ai_schema.sql`** completo.
Crea sin modificar nada existente:

- `ai_conversations (id, user_id, plant_id, title, created_at)`
- `ai_messages (id, conversation_id, user_id, role, content, model, prompt_tokens, response_tokens, created_at)`
- RLS `auth.uid() = user_id` en ambas + índices `idx_ai_conversations_user`, `idx_ai_messages_conversation`

Verificar:

```sql
select * from ai_conversations limit 1;  -- vacío, sin error
select * from ai_messages limit 1;       -- vacío, sin error
```

## 2. Secreto de Gemini (una vez)

```bash
supabase secrets set GEMINI_API_KEY=pega_tu_key_aqui
```

Comprobar (muestra el nombre, nunca el valor):

```bash
supabase secrets list
```

## 3. Deploy de la función

```bash
# Con proyecto linkado:
supabase functions deploy ai-chat

# Sin linkar:
supabase functions deploy ai-chat --project-ref <tu-ref>
```

Qué lleva dentro (`supabase/functions/ai-chat/index.ts`):

- Valida JWT (`auth.getUser()`), system prompt fijo no editable desde el cliente
- Rate-limit por usuario: **15 req/min** y **100 req/día** (429 si se excede)
- `temperature 0.4`, `maxOutputTokens 512`, modelo `gemini-2.5-flash`
- Persiste cada turno en `ai_conversations` / `ai_messages`

> Límites espejados en `src/ai/infrastructure/ai-limits.ts`. Si los cambias,
> actualiza `MAX_PER_MINUTE` / `MAX_PER_DAY` en ambos archivos.

## 4. Verificación extremo a extremo

1. `npm run dev` → login → `/ai` → envía “¿Qué planta necesita riego?”
   → debe llegar respuesta real (ya no mock).
2. `/analytics` → “Generar resumen” → debe aparecer el resumen.
3. Diagnóstico: elige planta → “Explicar con IA” → 4 viñetas.
4. Rate-limit: envía 16 mensajes en 1 minuto → el 16º falla con
   `Rate limit exceeded…` y la UI muestra el fallback determinista.
5. En el dashboard, comprueba filas nuevas en `ai_conversations`,
   `ai_messages` y eventos `ai_prompt` en `feature_interaction_logs`.

Si algo falla, ve a la tabla de errores abajo antes de tocar código.

## 5. Producción (Vercel)

Nada que cambiar: `vercel.json` ya redirige la SPA y la app no necesita
ninguna env nueva (la key vive en Supabase, no en `VITE_*`).

## Rollback

- Función rota: redesplegar la versión anterior desde
  Dashboard → Edge Functions → `ai-chat` → versión previa. La app sigue
  funcionando (muestra fallbacks deterministas + errores controlados).
- Tablas: no hace falta borrarlas; vacías no afectan a la app.
  Solo si quieres revertir el esquema: `drop table public.ai_messages;`
  `drop table public.ai_conversations;`

## Errores comunes

| Síntoma | Causa probable | Fix |
|---|---|---|
| 404 en `/functions/v1/ai-chat`, a veces enmascarado como error CORS del preflight (`does not have HTTP ok status`) | Función no desplegada en ese proyecto (el gateway responde 404 antes de ejecutar nada; la key ni se evalúa) | Pasos 1–3 de este runbook; la app ahora muestra “no está desplegada” en vez del error crudo |
| CORS: `No 'Access-Control-Allow-Origin' header is present on the requested resource` en POST | El helper `json()` no incluía `CORS_HEADERS` en respuestas de error (401, 500) o JSON normales | Asegurar que `CORS_HEADERS` esté en `json()` y redesplegar con `npx supabase functions deploy ai-chat --project-ref <tu-ref>` |
| Preflight 200 pero el navegador bloquea el POST (`apikey`/`x-client-info is not allowed by Access-Control-Allow-Headers`) | Handler OPTIONS sin esos headers (los envía supabase-js siempre) | Debe estar desplegada la versión con `Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info`. Comprobar: `curl -X OPTIONS <url> -H "Access-Control-Request-Headers: apikey,x-client-info,authorization,content-type" -i` → 200 y ambos headers listados |
| `Missing GEMINI_API_KEY secret` (500) | Paso 2 sin hacer | `supabase secrets set …` + redesplegar |
| `Unauthorized` (401) | JWT no llega a la función | Revisa login en la app; no bypassees el guard de `src/router.ts` |
| `Daily quota exceeded` (429) | Límite propio (100/día) o cuota Google | Espera o sube `MAX_PER_DAY`; revisa uso en AI Studio |
| `Gemini error: 4xx/5xx` (502) | Key inválida o API no habilitada | Regenera la key en AI Studio |
| Respuesta vacía (502) | Filtro de seguridad de Gemini | Reformula el system prompt, revisa logs con `supabase functions logs` |

## Post-despliegue (coste)

- Vigila `prompt_tokens` / `response_tokens` en `ai_messages` (columna por turno).
- La caché de insights (5 min, `insightsCacheKey`) y los agregados
  (nunca series crudas) ya minimizan llamadas; no envíes más contexto
  sin medir antes.

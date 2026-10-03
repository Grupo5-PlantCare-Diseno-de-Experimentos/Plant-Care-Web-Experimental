/**
 * Supabase Edge Function: ai-chat (Deno).
 *
 * Proxy seguro para Gemini 2.5 Flash (capa gratuita):
 * - La GEMINI_API_KEY vive como secreto del proyecto Supabase (Deno.env),
 *   nunca como VITE_* en el bundle frontend.
 * - Valida JWT Supabase (auth.getUser) y aplica RLS por auth.uid().
 * - Construye el prompt con contexto AGREGADO (sin series crudas),
 *   con system prompt fijo no editable desde el cliente.
 * - Rate-limit básico + persistencia en ai_conversations / ai_messages.
 *
 * Despliegue:
 *   supabase secrets set GEMINI_API_KEY=... 
 *   supabase functions deploy ai-chat
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const DEFAULT_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const CANDIDATE_MODELS = Array.from(
  new Set([
    DEFAULT_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
  ])
);

let cachedWorkingModel: string | null = null;

async function extractGeminiErrorMessage(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    const data = JSON.parse(raw);
    if (data.error?.message) {
      return `${data.error.message} (HTTP ${res.status})`;
    }
    return raw.slice(0, 300) || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Consulta dinámicamente ModelService.ListModels si los nombres estándar devuelven 404 */
async function getAvailableModel(apiKey: string): Promise<string | null> {
  if (cachedWorkingModel) return cachedWorkingModel;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[ai-chat] ListModels query failed:', res.status, err);
      return null;
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    if (!Array.isArray(data.models)) return null;

    const supported = data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && m.name)
      .map((m) => m.name!.replace(/^models\//, ''));

    console.log('[ai-chat] Available models with generateContent:', supported);

    // Preferir modelos 3.1-flash-lite, flash-lite, flash
    const selected =
      supported.find((m) => m.includes('3.1-flash-lite')) ||
      supported.find((m) => m.includes('3.5-flash-lite')) ||
      supported.find((m) => m.includes('flash-lite')) ||
      supported.find((m) => m.includes('flash') && !m.includes('image') && !m.includes('tts')) ||
      supported[0] ||
      null;

    if (selected) cachedWorkingModel = selected;
    return selected;
  } catch (err) {
    console.error('[ai-chat] Error fetching ListModels:', err);
    return null;
  }
}

const SYSTEM_PROMPT = [
  'Eres el asistente de PlantCare. Solo das consejos de cuidado de plantas.',
  'Usa únicamente el contexto agregado proporcionado (salud, riego, métricas).',
  'Si faltan datos, dilo y pide los mínimos necesarios. No inventes lecturas.',
  'Responde en el idioma solicitado (es/en), de forma breve y accionable.',
  'No das diagnósticos médicos ni consejos fuera de jardinería.',
].join(' ');

// Límite simple anti-abuso de capa gratuita (ajustar según cuota).
// Espejo de src/ai/infrastructure/ai-limits.ts (Deno no puede importarlo).
const MAX_PROMPT_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 512;
const MAX_PER_MINUTE = 15;
const MAX_PER_DAY = 100;

interface AiPlantContext {
  id: number;
  name: string;
  type: string;
  status: string;
  lastWatered: string;
  nextWatering: string;
  healthScore: number | null;
  avgHumidity: number | null;
  totalPlants: number;
}

interface ChatBody {
  prompt?: string;
  conversationId?: string | null;
  plantId?: number | null;
  context?: AiPlantContext | null;
  locale?: string;
  /** Si true, responde SSE token a token en vez de JSON completo. */
  stream?: boolean;
}

/** Extrae texto de un payload streamGenerateContent (espejo de ai-stream.ts). */
function extractStreamText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))
    .join('');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'Missing GEMINI_API_KEY secret' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  let body: ChatBody;
  try {
    body = await req.json() as ChatBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = (body.prompt ?? '').trim().slice(0, MAX_PROMPT_CHARS);
  if (!prompt) return json({ error: 'Empty prompt' }, 400);

  // Rate-limit por usuario sobre ai_messages propios (RLS auth.uid()=user_id).
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: lastMinute } = await supabase
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', minuteAgo);
  if ((lastMinute ?? 0) >= MAX_PER_MINUTE) {
    return json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429);
  }
  const { count: lastDay } = await supabase
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', dayAgo);
  if ((lastDay ?? 0) >= MAX_PER_DAY) {
    return json({ error: 'Daily quota exceeded. Try again tomorrow.' }, 429);
  }

  const locale = body.locale === 'en' ? 'en' : 'es';
  const contextText = body.context
    ? `Planta: ${body.context.name} (${body.context.type}), estado ${body.context.status}, ` +
    `score ${body.context.healthScore ?? 'n/d'}, humedad media ${body.context.avgHumidity ?? 'n/d'}, ` +
    `total plantas ${body.context.totalPlants}. Último riego ${body.context.lastWatered}, próximo ${body.context.nextWatering}.`
    : 'Sin contexto de plantas.';

  const geminiBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      { role: 'user', parts: [{ text: `[locale=${locale}] ${contextText}\nPregunta: ${prompt}` }] },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  // Modo stream: reenvía SSE token a token y persiste en segundo plano.
  if (body.stream === true) {
    return await handleStream({ supabase, userId: user.id, body, prompt, geminiBody, apiKey });
  }

  const modelsToTry = Array.from(new Set([
    ...(cachedWorkingModel ? [cachedWorkingModel] : []),
    ...CANDIDATE_MODELS,
  ]));

  let geminiRes: Response | null = null;
  let activeModel = modelsToTry[0];
  let lastError = '';

  for (const model of modelsToTry) {
    activeModel = model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (res.status === 429) {
      return json({ error: 'Quota exceeded. Try again later.' }, 429);
    }
    if (res.status === 404) {
      lastError = await extractGeminiErrorMessage(res);
      console.warn(`[ai-chat] Model ${model} returned 404, trying fallback...`);
      continue;
    }
    if (!res.ok) {
      lastError = await extractGeminiErrorMessage(res);
      console.error(`[ai-chat] Gemini error on ${model} (${res.status}):`, lastError);
      return json({ error: `Gemini error: ${lastError}` }, 502);
    }

    geminiRes = res;
    cachedWorkingModel = model;
    break;
  }

  if (!geminiRes) {
    const discovered = await getAvailableModel(apiKey);
    if (discovered && !modelsToTry.includes(discovered)) {
      console.log(`[ai-chat] Testing discovered model: ${discovered}`);
      activeModel = discovered;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${discovered}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      if (res.status === 429) {
        return json({ error: 'Quota exceeded. Try again later.' }, 429);
      }
      if (res.ok) {
        geminiRes = res;
        cachedWorkingModel = discovered;
      } else {
        lastError = await extractGeminiErrorMessage(res);
      }
    }
  }

  if (!geminiRes) {
    let availableInfo = '';
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const j = (await listRes.json()) as { models?: Array<{ name?: string }> };
        if (Array.isArray(j?.models)) {
          availableInfo = ` Modelos disponibles en tu key: ${j.models.map((m) => m.name?.replace(/^models\//, '')).filter(Boolean).slice(0, 10).join(', ')}`;
        }
      }
    } catch { /* noop */ }
    return json({ error: `Gemini error: ${lastError || 'No available Gemini model found'}.${availableInfo}` }, 502);
  }

  const geminiJson = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const reply = geminiJson.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
  if (!reply) return json({ error: 'Empty Gemini reply' }, 502);

  const promptTokens = geminiJson.usageMetadata?.promptTokenCount ?? null;
  const responseTokens = geminiJson.usageMetadata?.candidatesTokenCount ?? null;

  // Persistencia historial (RLS auth.uid()=user_id).
  let conversationId = body.conversationId ?? null;
  if (!conversationId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: user.id,
        plant_id: body.plantId ?? body.context?.id ?? null,
        title: prompt.slice(0, 80),
      })
      .select('id')
      .single();
    if (error) return json({ error: 'Cannot create conversation' }, 500);
    conversationId = (data as { id: string }).id;
  }

  await supabase.from('ai_messages').insert([
    { conversation_id: conversationId, user_id: user.id, role: 'user', content: prompt, model: activeModel },
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: 'assistant',
      content: reply,
      model: activeModel,
      prompt_tokens: promptTokens,
      response_tokens: responseTokens,
    },
  ]);

  return json({
    reply,
    conversationId,
    model: activeModel,
    promptTokens,
    responseTokens,
  });
});

interface StreamDeps {
  supabase: {
    from(table: string): {
      insert(
        row: unknown
      ):
        | { select(col: string): { single(): Promise<{ data: unknown; error: unknown }> } }
        | Promise<{ error: unknown }>;
    };
  };
  userId: string;
  body: ChatBody;
  prompt: string;
  geminiBody: unknown;
  apiKey: string;
}

/** Lee una rama SSE completa y devuelve el texto acumulado. */
async function readStreamText(branch: ReadableStream<Uint8Array>): Promise<string> {
  const reader = branch.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  const processLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice('data:'.length).trim();
    if (data === '' || data === '[DONE]') return;
    try {
      full += extractStreamText(JSON.parse(data) as unknown);
    } catch {
      buffer = line + '\n' + buffer;
    }
  };
  try {
    for (; ;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    }
    if (buffer.trim() !== '') processLine(buffer);
    buffer = '';
  } finally {
    reader.releaseLock();
  }
  return full;
}

/**
 * Modo stream: crea la conversación por adelantado, reenvía el SSE de
 * Gemini tal cual al cliente y persiste ambos mensajes en segundo plano.
 * El id de conversación viaja en el header `X-Conversation-Id`.
 */
async function handleStream(deps: StreamDeps): Promise<Response> {
  const { supabase, userId, body, prompt, geminiBody, apiKey } = deps;

  let conversationId = body.conversationId ?? null;
  if (!conversationId) {
    const creator = supabase.from('ai_conversations').insert({
      user_id: userId,
      plant_id: body.plantId ?? body.context?.id ?? null,
      title: prompt.slice(0, 80),
    });
    const { data, error } = await (
      creator as {
        select(col: string): { single(): Promise<{ data: unknown; error: unknown }> };
      }
    )
      .select('id')
      .single();
    if (error) return json({ error: 'Cannot create conversation' }, 500);
    conversationId = (data as { id: string }).id;
  }

  const modelsToTry = Array.from(new Set([
    ...(cachedWorkingModel ? [cachedWorkingModel] : []),
    ...CANDIDATE_MODELS,
  ]));

  let upstream: Response | null = null;
  let activeModel = modelsToTry[0];
  let lastError = '';

  for (const model of modelsToTry) {
    activeModel = model;
    const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (res.status === 429) {
      return json({ error: 'Quota exceeded. Try again later.' }, 429);
    }
    if (res.status === 404) {
      lastError = await extractGeminiErrorMessage(res);
      console.warn(`[ai-chat] Model ${model} returned 404, trying fallback...`);
      continue;
    }
    if (!res.ok || !res.body) {
      lastError = await extractGeminiErrorMessage(res);
      console.error(`[ai-chat] Gemini stream error on ${model} (${res.status}):`, lastError);
      return json({ error: `Gemini error: ${lastError}` }, 502);
    }

    upstream = res;
    cachedWorkingModel = model;
    break;
  }

  if (!upstream || !upstream.body) {
    const discovered = await getAvailableModel(apiKey);
    if (discovered && !modelsToTry.includes(discovered)) {
      console.log(`[ai-chat] Testing discovered stream model: ${discovered}`);
      activeModel = discovered;
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${discovered}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      if (res.status === 429) {
        return json({ error: 'Quota exceeded. Try again later.' }, 429);
      }
      if (res.ok && res.body) {
        upstream = res;
        cachedWorkingModel = discovered;
      } else {
        lastError = await extractGeminiErrorMessage(res);
      }
    }
  }

  if (!upstream || !upstream.body) {
    let availableInfo = '';
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const j = (await listRes.json()) as { models?: Array<{ name?: string }> };
        if (Array.isArray(j?.models)) {
          availableInfo = ` Modelos disponibles en tu key: ${j.models.map((m) => m.name?.replace(/^models\//, '')).filter(Boolean).slice(0, 10).join(', ')}`;
        }
      }
    } catch { /* noop */ }

    return json({ error: `Gemini error: ${lastError || 'No available Gemini model found'}` }, 502);
  }

  const [clientBranch, persistBranch] = upstream.body.tee();
  const persistPromise = (async (): Promise<void> => {
    const fullText = (await readStreamText(persistBranch)).trim();
    if (!fullText) return;
    await supabase.from('ai_messages').insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: prompt,
        model: activeModel,
      },
      {
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: fullText,
        model: activeModel,
        prompt_tokens: null,
        response_tokens: null,
      },
    ]);
  })().catch((e: unknown) => {
    console.error('[ai-chat] background persist failed:', e);
  });

  const runtime = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil(p: Promise<unknown>): void };
    }
  ).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(persistPromise);
  else void persistPromise;

  return new Response(clientBranch, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Expose-Headers': 'X-Conversation-Id',
      'X-Conversation-Id': conversationId ?? '',
    },
  });
}

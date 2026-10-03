import type { Page } from '@playwright/test';

export const E2E_USER = {
  id: 'e2e-user-1',
  email: 'e2e@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const NOW_ISO = new Date().toISOString();

export const E2E_PLANT = {
  id: 1,
  user_id: E2E_USER.id,
  name: 'Monstera E2E',
  type: 'interior',
  img_url: '',
  bio: '',
  location: 'salón',
  status: 'healthy',
  last_watered: NOW_ISO,
  created_at: NOW_ISO,
  metrics: [
    {
      id: 11,
      plant_id: 1,
      device_id: 'dev-e2e',
      timestamp: NOW_ISO,
      air_humidity_pct: 55,
      temperature_c: 22,
      soil_moisture_pct: 60,
      light_level: 500,
      battery_level: 90,
    },
  ],
  watering_logs: [],
};

export const E2E_METRICS = [
  {
    id: 11,
    plant_id: 1,
    timestamp: NOW_ISO,
    air_humidity_pct: 55,
    temperature_c: 22,
    soil_moisture_pct: 60,
    light_level: 500,
    device_id: 'dev-e2e',
  },
];

export const E2E_CONVERSATIONS = [
  {
    id: 'conv-seed-1',
    user_id: E2E_USER.id,
    plant_id: 1,
    title: 'Riego Monstera',
    created_at: NOW_ISO,
  },
  {
    id: 'conv-seed-2',
    user_id: E2E_USER.id,
    plant_id: null,
    title: 'Dudas generales',
    created_at: NOW_ISO,
  },
];

export const E2E_SEEDED_MESSAGES = [
  {
    id: 'msg-seed-1',
    conversation_id: 'conv-seed-1',
    user_id: E2E_USER.id,
    role: 'user',
    content: '¿Cada cuánto riego?',
    model: 'client',
    prompt_tokens: null,
    response_tokens: null,
    created_at: NOW_ISO,
  },
  {
    id: 'msg-seed-2',
    conversation_id: 'conv-seed-1',
    user_id: E2E_USER.id,
    role: 'assistant',
    content: 'Mock IA historial: riega cada 7 días.',
    model: 'gemini-2.5-flash',
    prompt_tokens: 5,
    response_tokens: 8,
    created_at: NOW_ISO,
  },
];
const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

/**
 * Sesión Supabase falsa en sessionStorage.
 * El cliente usa `storage: window.sessionStorage` con clave
 * `sb-<ref>-auth-token`; se intercepta getItem por prefijo/sufijo
 * para no depender del ref real del proyecto.
 */
export async function seedSupabaseSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const session = {
      access_token: 'e2e-access-token',
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: 'e2e-user-1',
        email: 'e2e@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };
    const raw = JSON.stringify(session);
    const proto = Storage.prototype;
    const origGet = proto.getItem;
    proto.getItem = function (key: string | null) {
      if (
        typeof key === 'string' &&
        key.startsWith('sb-') &&
        key.endsWith('-auth-token')
      ) {
        return raw;
      }
      return origGet.call(this, key);
    };
  });
}

/**
 * Mockea Supabase Auth + PostgREST + Edge Function ai-chat.
 * Respuestas condicionales según el prompt (skill playwright-cli:
 * request-mocking avanzado con route handler).
 */
export async function mockSupabaseApi(page: Page): Promise<void> {
  await page.route('**/auth/v1/user', (route) => route.fulfill(json(E2E_USER)));

  await page.route('**/rest/v1/plants*', (route) =>
    route.fulfill(json([E2E_PLANT]))
  );

  await page.route('**/rest/v1/plant_metrics*', (route) =>
    route.fulfill(json(E2E_METRICS))
  );

  await page.route('**/rest/v1/ai_conversations*', (route) => {
    const method = route.request().method();
    if (method === 'DELETE') return route.fulfill(json([]));
    if (method === 'PATCH' || method === 'PUT') {
      const body = route.request().postDataJSON() as { title?: string } | null;
      return route.fulfill(
        json({ ...E2E_CONVERSATIONS[0], title: body?.title ?? 'Renombrada E2E' })
      );
    }
    return route.fulfill(json(E2E_CONVERSATIONS));
  });

  await page.route('**/rest/v1/ai_messages*', (route) => {
    const url = route.request().url();
    if (url.includes('conv-seed-1')) {
      return route.fulfill(json(E2E_SEEDED_MESSAGES));
    }
    return route.fulfill(json([]));
  });

  await page.route('**/rest/v1/profiles*', (route) =>
    route.fulfill(json([]))
  );

  await page.route('**/functions/v1/ai-chat', (route) => {
    const postData = route.request().postDataJSON() as {
      prompt?: string;
    } | null;
    const prompt = postData?.prompt ?? '';
    let reply = 'Mock IA: riega tu Monstera E2E cuando el suelo baje del 30%.';
    if (prompt.includes('viñetas cortas (estado, causa')) {
      reply =
        'Mock IA diagnóstico: estado healthy, causa óptima, plan de riego normal, próxima acción observar.';
    } else if (prompt.includes('viñetas cortas (tendencia')) {
      reply =
        'Mock IA resumen: tendencia estable, sin anomalías, acción mantener riego.';
    }
    return route.fulfill(
      json({
        reply,
        conversationId: 'conv-e2e-1',
        model: 'gemini-2.5-flash',
        promptTokens: 10,
        responseTokens: 20,
      })
    );
  });
}

/** Escenario base: sesión + mocks antes de cada navegación. */
export async function setupAiE2E(page: Page): Promise<void> {
  await seedSupabaseSession(page);
  await mockSupabaseApi(page);
}

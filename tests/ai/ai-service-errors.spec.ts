import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { toFriendlyFunctionError } from '../../src/ai/infrastructure/ai.service';

const httpError = (status: number, body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  ),
});

describe('toFriendlyFunctionError', () => {
  it('maps gateway 404 (plain or via Response context) to not-deployed', async () => {
    await expect(toFriendlyFunctionError({ status: 404 })).resolves.toMatchObject({ message: expect.stringContaining('no está desplegada') });
    await expect(toFriendlyFunctionError(httpError(404, { code: 'NOT_FOUND' }))).resolves.toMatchObject({ message: expect.stringContaining('no está desplegada') });
  });

  it('maps network failures (CORS-masked 404) to not-deployed', async () => {
    for (const message of [
      'Failed to send a request to the Edge Function',
      'Failed to fetch',
      'net::ERR_FAILED',
    ]) {
      await expect(toFriendlyFunctionError(new Error(message))).resolves.toMatchObject({
        message: expect.stringContaining('no está desplegada'),
      });
    }
    await expect(
      toFriendlyFunctionError({
        name: 'FunctionsFetchError',
        message: 'Failed to send a request to the Edge Function',
      })
    ).resolves.toMatchObject({
      message: expect.stringContaining('no está desplegada'),
    });
  });

  it('rescues the deployed function message (429 quota, 500)', async () => {
    await expect(
      toFriendlyFunctionError(httpError(429, { error: 'Daily quota exceeded.' }))
    ).resolves.toMatchObject({ message: 'Daily quota exceeded.' });
  });

  it('keeps unrelated errors untouched', async () => {
    const original = new Error('boom');
    await expect(toFriendlyFunctionError(original)).resolves.toBe(original);
  });
});

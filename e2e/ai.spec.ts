import { expect, test } from '@playwright/test';
import { setupAiE2E } from './helpers';

test.describe('Ai — chat, diagnóstico e insights (mockeados)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAiE2E(page);
  });

  test('chat contextual responde con la Edge Function mockeada', async ({
    page,
  }) => {
    await page.goto('/ai');

    await expect(page.getByTestId('ai-chat-view')).toBeVisible();
    await expect(page.getByTestId('ai-plant-select')).toBeVisible();

    await page.getByTestId('ai-prompt-input').fill('¿Qué planta necesita riego?');
    await page.getByTestId('ai-prompt-submit').click();

    const list = page.getByTestId('ai-message-list');
    await expect(list).toContainText('¿Qué planta necesita riego?');
    await expect(list).toContainText('Mock IA: riega tu Monstera E2E');
  });

  test('diagnóstico determinista + explicación IA mockeada', async ({
    page,
  }) => {
    await page.goto('/ai');

    const card = page.getByTestId('ai-diagnosis-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Monstera E2E');

    await page.getByTestId('ai-explain-btn').click();
    await expect(page.getByTestId('ai-explanation')).toContainText(
      'Mock IA diagnóstico'
    );
  });

  test('chat en streaming renderiza markdown sanitizado', async ({
    page,
  }) => {
    // El mock base (beforeEach) gana por orden de registro: se sustituye.
    await page.unroute('**/functions/v1/ai-chat');
    await page.route(
      '**/functions/v1/ai-chat',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: { 'X-Conversation-Id': 'conv-e2e-stream' },
          body:
            'data: {"candidates":[{"content":{"parts":[{"text":"# Riego\\n\\n- cada"}]}}]}}\n\n' +
            'data: {"candidates":[{"content":{"parts":[{"text":" 7 días"}]}}]}}\n\n',
        }),
      { times: 1 }
    );
    await page.goto('/ai');

    await page.getByTestId('ai-prompt-input').fill('¿Cada cuánto riego?');
    await page.getByTestId('ai-prompt-submit').click();

    const markdown = page.getByTestId('ai-markdown').last();
    await expect(markdown.locator('h1')).toContainText('Riego');
    await expect(markdown).toContainText('cada 7 días');
  });

  test('función ausente (404) muestra error accionable', async ({
    page,
  }) => {
    await page.unroute('**/functions/v1/ai-chat');
    await page.route('**/functions/v1/ai-chat', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND' }),
      })
    );
    await page.goto('/ai');

    await page.getByTestId('ai-prompt-input').fill('hola');
    await page.getByTestId('ai-prompt-submit').click();

    await expect(page.getByTestId('ai-error')).toContainText(
      'no está desplegada'
    );
  });

  test('historial: lista, carga y nueva conversación', async ({ page }) => {
    await page.goto('/ai');

    const list = page.getByTestId('ai-conversation-list');
    await expect(list).toContainText('Riego Monstera');
    await expect(list).toContainText('Dudas generales');

    await page
      .getByTestId('ai-conversation-item')
      .filter({ hasText: 'Riego Monstera' })
      .click();
    await expect(page.getByTestId('ai-message-list')).toContainText(
      'Mock IA historial: riega cada 7 días.'
    );

    await page.getByTestId('ai-new-conversation').click();
    await expect(page.getByTestId('ai-message-list')).toContainText(
      'Aún no hay mensajes'
    );
  });

  test('historial: buscar filtra la lista', async ({ page }) => {
    await page.goto('/ai');

    const search = page.getByTestId('ai-conversation-search');
    await expect(search).toBeVisible();
    await search.fill('monstera');

    const list = page.getByTestId('ai-conversation-list');
    await expect(list).toContainText('Riego Monstera');
    await expect(list).not.toContainText('Dudas generales');

    await search.fill('xyz-sin-resultados');
    await expect(page.getByTestId('ai-conversation-no-results')).toBeVisible();
  });

  test('historial: renombrar actualiza el título', async ({ page }) => {
    await page.goto('/ai');

    await page.getByTestId('ai-conversation-rename').first().click();
    const input = page.getByTestId('ai-conversation-rename-input');
    await expect(input).toBeVisible();
    await input.fill('Renombrada E2E');
    await page.getByTestId('ai-conversation-rename-save').click();

    await expect(page.getByTestId('ai-conversation-list')).toContainText(
      'Renombrada E2E'
    );
  });

  test('historial: eliminar pide confirmación y quita el item', async ({
    page,
  }) => {
    await page.goto('/ai');

    const list = page.getByTestId('ai-conversation-list');
    await expect(list).toContainText('Riego Monstera');

    await page.getByTestId('ai-conversation-delete').first().click();
    await page.getByRole('button', { name: /eliminar/i }).last().click();

    await expect(list).not.toContainText('Riego Monstera');
    await expect(list).toContainText('Dudas generales');
  });

  test('insights de Analytics con métricas mockeadas', async ({ page }) => {
    await page.goto('/analytics');

    const panel = page.getByTestId('ai-insights-panel');
    await expect(panel).toBeVisible();

    await page.getByTestId('ai-insights-generate').click();
    await expect(page.getByTestId('ai-insights-text')).toContainText(
      'Mock IA resumen'
    );
  });
});

import { expect, test } from '@playwright/test';
import { setupAiE2E } from './helpers';

test('debug streaming dom', async ({ page }) => {
  await setupAiE2E(page);
  const probe = await page.evaluate(() => {
    const body =
      'data: {"candidates":[{"content":{"parts":[{"text":"# Riego\\n\\n- cada"}]}}]}}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":" 7 días"}]}}]}}\n\n';
    const firstLine = body.split('\n')[0];
    const data = firstLine.slice('data:'.length).trim();
    let parseError = '';
    try {
      JSON.parse(data);
    } catch (e) {
      parseError = String(e);
    }
    const codes: number[] = [];
    for (let i = 40; i < 72 && i < data.length; i++) codes.push(data.charCodeAt(i));
    return { len: body.length, dataLen: data.length, parseError, codes, tail: data.slice(-14) };
  });
  console.log('[probe-tokens]', JSON.stringify(probe));
  page.on('request', (req) => {
    if (req.url().includes('ai-chat')) console.log('[req]', req.method(), req.url());
  });
  page.on('response', (res) => {
    if (res.url().includes('ai-chat')) console.log('[res]', res.status(), res.url());
  });
  await page.on('requestfailed', (req) => {
    if (req.url().includes('ai-chat')) console.log('[reqfail]', req.failure()?.errorText, req.url());
  });
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
  await page.waitForTimeout(6000);
  const html = await page.getByTestId('ai-message-list').innerHTML();
  console.log('[dom]', html.slice(0, 1500));
  const errVisible = await page.getByTestId('ai-error').isVisible().catch(() => false);
  console.log('[ai-error visible]', errVisible);
  if (errVisible) console.log('[ai-error text]', await page.getByTestId('ai-error').textContent());
  expect(true).toBe(true);
});

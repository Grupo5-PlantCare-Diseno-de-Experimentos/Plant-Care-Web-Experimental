import { test } from '@playwright/test';
import { seedSupabaseSession, mockSupabaseApi, E2E_PLANT } from './helpers';

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const now = new Date().toISOString();

test('visual formulario con sensor emparejado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('app_theme', 'Light'));
  await seedSupabaseSession(page);
  await mockSupabaseApi(page);

  await page.unroute('**/rest/v1/plants*');
  await page.route('**/rest/v1/plants*', (route) => {
    const url = route.request().url();
    const plant = { ...E2E_PLANT, metrics: [], device_id: 'esp32-wokwi-01' };
    if (/[?&]id=eq\./.test(url)) return route.fulfill(json(plant));
    return route.fulfill(json([plant]));
  });
  await page.unroute('**/rest/v1/plant_metrics*');
  await page.route('**/rest/v1/plant_metrics*', (route) =>
    route.fulfill(
      json([{ id: 9, plant_id: null, device_id: 'esp32-wokwi-01', timestamp: now }])
    )
  );

  await page.goto('/plants/new');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/mnt/c/tmp/opencode/shots3/plants-new.png', fullPage: true });

  await page.goto('/plants/edit/1');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/mnt/c/tmp/opencode/shots3/plants-edit.png', fullPage: true });

  await page.goto('/plants/1');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/mnt/c/tmp/opencode/shots3/plant-detail.png', fullPage: true });
});

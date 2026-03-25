import { test, expect, type Page } from '@playwright/test';

const SIMPLE_POLYLINE = '_p~iF~ps|U_ulLnnqC';

async function prepareApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
  });
}

test.describe('Route Alternatives', () => {
  test('shows alternative routes and lets the user switch between them in the panel and map overlay', async ({ page, context }) => {
    await prepareApp(page);

    let orsRequests = 0;
    await context.route(/https:\/\/nominatim\.openstreetmap\.org\/search.*/, async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') ?? '';
      const isOrigin = query.includes('דיזנגוף');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify([
          {
            lat: isOrigin ? '32.0853' : '32.0809',
            lon: isOrigin ? '34.7818' : '34.7806',
            display_name: isOrigin ? 'דיזנגוף סנטר, תל אביב' : 'כיכר הבימה, תל אביב',
          },
        ]),
      });
    });

    await context.route('https://api.openrouteservice.org/**', async (route) => {
      orsRequests += 1;
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      };

      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({
          routes: [
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 840, distance: 1600 },
            },
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 720, distance: 1700 },
            },
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 960, distance: 1500 },
            },
          ],
        }),
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByPlaceholder('נקודת מוצא...').fill('דיזנגוף');
    await expect(page.locator('.autocomplete-item')).toHaveCount(1);
    await page.locator('.autocomplete-item').first().click();

    await page.getByPlaceholder('יעד...').fill('הבימה');
    await expect(page.locator('.autocomplete-item')).toHaveCount(1);
    await page.locator('.autocomplete-item').first().click();

    await page.locator('.search-btn').click();
    await expect.poll(() => orsRequests, { timeout: 10000 }).toBeGreaterThan(0);

    const routeSelector = page.locator('.route-selector');
    await expect(routeSelector).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.route-option')).toHaveCount(3);
    await expect(page.locator('.route-option-fastest-badge')).toContainText('הכי מהיר');
    await expect(page.locator('.route-picker-overlay')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.route-picker-item')).toHaveCount(3);

    await page.locator('.route-option').nth(1).click();

    await expect(page.locator('.route-option').nth(1)).toHaveClass(/route-option-selected/);
    await expect(page.locator('.route-picker-item').nth(1)).toHaveClass(/route-picker-item-active/);

    await page.locator('.route-picker-item').nth(2).click();

    await expect(page.locator('.route-option').nth(2)).toHaveClass(/route-option-selected/);
    await expect(page.locator('.route-picker-item').nth(2)).toHaveClass(/route-picker-item-active/);
  });
});

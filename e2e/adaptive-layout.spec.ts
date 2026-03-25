import { expect, test, type Page } from '@playwright/test';

const SIMPLE_POLYLINE = '_p~iF~ps|U_ulLnnqC';

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
  });
}

async function gotoShell(page: Page) {
  await seed(page);
  await page.goto('/', { waitUntil: 'networkidle' });
}

async function mockRouteAlternatives(page: Page) {
  const context = page.context();

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
        routes: Array.from({ length: 8 }, (_, index) => ({
          geometry: SIMPLE_POLYLINE,
          summary: {
            duration: 720 + index * 60,
            distance: 1500 + index * 80,
          },
        })),
      }),
    });
  });
}

test('uses the desktop rail at wide widths', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

  await gotoShell(page);

  await expect(page.locator('.app-section-nav-desktop')).toBeVisible();
  await expect(page.locator('.app-section-nav-mobile')).toHaveCount(0);
  await expect(page.locator('.panel-column .search-panel')).toBeVisible();
});

test('keeps the desktop glass nav fixed while the search rail scrolls', async ({ page, context }) => {
  await page.setViewportSize({ width: 1385, height: 768 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });
  await mockRouteAlternatives(page);

  await gotoShell(page);

  const nav = page.locator('.app-section-nav-desktop');
  const searchPanel = page.locator('.panel-column .search-panel');

  const navBoxBefore = await nav.boundingBox();
  expect(navBoxBefore).not.toBeNull();

  await page.getByPlaceholder('נקודת מוצא...').fill('דיזנגוף');
  await page.locator('.autocomplete-item').first().click();
  await page.getByPlaceholder('יעד...').fill('הבימה');
  await page.locator('.autocomplete-item').first().click();
  await page.locator('.search-btn').click();

  await expect(page.locator('.route-selector')).toBeVisible({ timeout: 10000 });

  const scrollMetrics = await searchPanel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  const navBoxAfter = await nav.boundingBox();
  expect(navBoxAfter).not.toBeNull();
  expect(navBoxAfter!.height).toBeGreaterThan(60);
  expect(Math.abs(navBoxAfter!.height - navBoxBefore!.height)).toBeLessThan(2);

  const scrolled = await searchPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop > 0;
  });

  expect(scrolled).toBe(true);
});

test('uses the compact rail at tablet widths', async ({ page, context }) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

  await gotoShell(page);

  await expect(page.locator('.app-section-nav-desktop')).toBeVisible();
  await expect(page.locator('.app-section-nav-mobile')).toHaveCount(0);
  await page.getByRole('button', { name: /Family|משפחה|العائلة|семья/i }).click();
  await expect(page.locator('.app-section-panel')).toBeVisible();
});

test('keeps the top glass nav on phone widths', async ({ page, context }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

  await gotoShell(page);

  await expect(page.locator('.app-section-nav-mobile')).toBeVisible();
  await expect(page.locator('.app-section-nav-desktop')).toHaveCount(0);
  await expect(page.locator('.search-panel')).toBeVisible();
});

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const SIMPLE_POLYLINE = '_p~iF~ps|U_ulLnnqC';

async function prepareApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
  });
}

async function openEmergencyMode(page: Page) {
  const emergencyButton = page.locator('.emergency-quick-btn');
  await expect(emergencyButton).toBeVisible({ timeout: 10000 });
  await emergencyButton.click();
  await expect(page.locator('.emergency-mode-surface')).toBeVisible({ timeout: 15000 });
}

async function enableGeolocation(context: BrowserContext) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });
}

test.describe('Emergency Mode', () => {
  test('clicking emergency button shows the current emergency surface with navigation CTA', async ({ page, context }) => {
    await enableGeolocation(context);
    await prepareApp(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openEmergencyMode(page);

    await expect(page.locator('.emergency-mode-title')).toHaveText('מצא מקלט קרוב עכשיו');
    await expect(page.locator('.emergency-navigate-now-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.shelter-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('can exit emergency mode and return to the normal search surface', async ({ page, context }) => {
    await enableGeolocation(context);
    await prepareApp(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openEmergencyMode(page);

    await page.locator('.emergency-mode-exit').click();

    await expect(page.locator('.emergency-mode-surface')).toHaveCount(0);
    await expect(page.locator('.emergency-quick-btn')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.search-mode-tabs')).toBeVisible({ timeout: 5000 });
  });

  test('falls back to map center when geolocation is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('shelter-route:onboarding-completed', 'true');

      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    await openEmergencyMode(page);

    await expect(page.locator('.emergency-map-center-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.emergency-permission-hint')).toContainText('ניתן לאפשר שירותי מיקום');
    await expect(page.locator('.emergency-mode-subtitle')).toContainText('הדפדפן לא תומך בשירותי מיקום');

    await page.locator('.emergency-map-center-btn').click();

    await expect(page.locator('.emergency-navigate-now-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.shelter-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('offers the last known location when location permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('shelter-route:onboarding-completed', 'true');
      localStorage.setItem('shelter-route:last-known-location', JSON.stringify({
        lat: 32.0853,
        lng: 34.7818,
        savedAt: Date.now() - 60_000,
      }));

      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: unknown, error: (err: { code: number; message: string }) => void) => {
            setTimeout(() => error({ code: 1, message: 'Permission denied' }), 0);
          },
          watchPosition: (_success: unknown, error: (err: { code: number; message: string }) => void) => {
            setTimeout(() => error({ code: 1, message: 'Permission denied' }), 0);
            return 1;
          },
          clearWatch: () => {},
        },
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    await openEmergencyMode(page);

    await expect(page.locator('.emergency-last-known-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.emergency-mode-subtitle')).toContainText('גישה למיקום נדחתה');

    await page.locator('.emergency-last-known-btn').click();

    await expect(page.locator('.emergency-mode-subtitle')).toContainText('המיקום הידוע האחרון');
    await expect(page.locator('.emergency-navigate-now-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.shelter-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('continues emergency mode when the network drops after shelters were already loaded', async ({ page, context }) => {
    await enableGeolocation(context);
    await prepareApp(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await context.setOffline(true);

    await openEmergencyMode(page);

    await expect(page.locator('.emergency-mode-notice')).toContainText(
      'אין חיבור לרשת. ממשיכים עם נתוני המקלטים שכבר נטענו באפליקציה.'
    );
    await expect(page.locator('.emergency-navigate-now-btn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.shelter-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('starts shelter navigation from emergency results and can cancel back to emergency mode', async ({ page, context }) => {
    await enableGeolocation(context);
    await prepareApp(page);

    let orsRequests = 0;
    await page.route('https://api.openrouteservice.org/**', async (route) => {
      orsRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          routes: [
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 480, distance: 620 },
            },
          ],
        }),
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await openEmergencyMode(page);

    const mapMarkerButton = page
      .getByRole('application', { name: 'מפת מקלטים' })
      .getByRole('button', { name: /מ׳/ })
      .first();

    await expect(mapMarkerButton).toBeVisible({ timeout: 10000 });
    await mapMarkerButton.click();
    await expect(page.locator('.shelter-popup-nav-btn')).toBeVisible({ timeout: 10000 });

    await page.locator('.shelter-popup-nav-btn').click();

    await expect(page.locator('.navigation-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.navigation-panel-cancel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.panel-column')).toHaveCount(0);
    expect(orsRequests).toBeGreaterThan(0);

    await page.locator('.navigation-panel-cancel').click();

    await expect(page.locator('.navigation-panel')).toHaveCount(0);
    await expect(page.locator('.panel-column')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.emergency-mode-surface')).toBeVisible({ timeout: 10000 });
  });
});

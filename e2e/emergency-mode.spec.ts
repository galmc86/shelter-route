import { test, expect, type Page, type BrowserContext } from '@playwright/test';

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
});

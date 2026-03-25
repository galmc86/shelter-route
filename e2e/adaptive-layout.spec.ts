import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
  });
}

async function gotoShell(page: Page) {
  await seed(page);
  await page.goto('/', { waitUntil: 'networkidle' });
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

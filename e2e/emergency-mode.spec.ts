import { test, expect } from '@playwright/test';

test.describe('Emergency Mode', () => {
  test('clicking emergency button shows nearest shelters panel', async ({ page, context }) => {
    // Mock geolocation to Tel Aviv area
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

    await page.goto('/');

    // Click the emergency button in the search panel
    const emergencyButton = page.locator('.emergency-quick-btn');
    await expect(emergencyButton).toBeVisible({ timeout: 10000 });
    await emergencyButton.click();

    // Verify the emergency banner appears (may take time for geolocation)
    const emergencyBanner = page.locator('.emergency-banner');
    await expect(emergencyBanner).toBeVisible({ timeout: 15000 });

    // Verify emergency banner title text
    await expect(page.getByText('מצב חירום')).toBeVisible({ timeout: 5000 });

    // Verify the exit button is available
    const exitButton = page.getByText('חזור');
    await expect(exitButton).toBeVisible();
  });

  test('can exit emergency mode', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

    await page.goto('/');

    // Enter emergency mode
    const emergencyButton = page.locator('.emergency-quick-btn');
    await expect(emergencyButton).toBeVisible({ timeout: 10000 });
    await emergencyButton.click();

    // Wait for emergency banner (may take time for geolocation)
    await expect(page.locator('.emergency-banner')).toBeVisible({ timeout: 15000 });

    // Click exit
    const exitButton = page.getByText('חזור');
    await exitButton.click();

    // Emergency banner should disappear and emergency button should reappear
    await expect(page.locator('.emergency-banner')).not.toBeVisible({ timeout: 5000 });
    await expect(emergencyButton).toBeVisible({ timeout: 5000 });
  });
});

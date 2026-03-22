import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Shelter/i);
  });

  test('map container exists', async ({ page }) => {
    await page.goto('/');
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
  });

  test('search panel is visible with emergency button', async ({ page }) => {
    await page.goto('/');
    const emergencyButton = page.getByText('מצא מקלט קרוב עכשיו');
    await expect(emergencyButton).toBeVisible({ timeout: 10000 });
  });
});

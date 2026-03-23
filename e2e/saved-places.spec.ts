import { test, expect } from '@playwright/test';

test.describe('Saved Places', () => {
  test('saved place opens nearby shelter mode and can be exited', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });

    await page.addInitScript(() => {
      localStorage.setItem('shelter-route:onboarding-completed', 'true');
      localStorage.removeItem('shelter-route:saved-locations');
    });

    await page.goto('/');

    await page.locator('.route-planner-toggle').click();
    await page.getByRole('button', { name: 'השתמש במיקום הנוכחי שלי' }).click();

    const addSavedPlaceButton = page.locator('.saved-location-add-btn');
    await expect(addSavedPlaceButton).toBeVisible({ timeout: 15000 });

    await addSavedPlaceButton.click();
    await page.getByRole('button', { name: 'עבודה', exact: true }).click();
    await page.getByPlaceholder('שם המיקום...').fill('בדיקת מקום שמור');
    await page.locator('.saved-location-save-btn').click();

    const savedPlaceButton = page.getByRole('button', {
      name: 'בדיקת מקום שמור - לחץ למציאת מקלטים קרובים',
    });
    await expect(savedPlaceButton).toBeVisible({ timeout: 10000 });
    await savedPlaceButton.click();

    await expect(page.locator('.nearby-results-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.nearby-results-banner-title')).toHaveText('מקלטים קרובים');
    await expect(page.locator('.nearby-results-banner-subtitle')).toHaveText('בדיקת מקום שמור');
    await expect(page.locator('.nearby-results-banner-mode')).toHaveText('מחפש מתוך מקום שמור');
    await expect(page.locator('.route-planner-toggle')).toHaveCount(0);
    await expect(page.locator('.saved-location-add-btn')).toHaveCount(0);

    const results = page.locator('.shelter-item');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
    await expect(results).toHaveCount(10);

    await page.locator('.nearby-results-banner-exit').click();

    await expect(page.locator('.nearby-results-banner')).toHaveCount(0);
    await expect(page.locator('.route-planner-toggle')).toBeVisible();
    await expect(page.locator('.saved-location-add-btn')).toBeVisible();
    await expect(savedPlaceButton).toBeVisible();
  });
});

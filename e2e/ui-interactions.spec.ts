import { test, expect } from '@playwright/test';

test.describe('UI Interactions', () => {
  test('toggle language from Hebrew to English', async ({ page }) => {
    await page.goto('/');

    // The app starts in Hebrew; the language toggle button shows "EN"
    const langButton = page.locator('.lang-toggle-btn');
    await expect(langButton).toBeVisible({ timeout: 10000 });
    await expect(langButton).toHaveText('EN');

    // Verify Hebrew subtitle is shown before toggling
    await expect(page.getByText('מצא מקלטים לאורך המסלול שלך')).toBeVisible();

    // Click to switch to English
    await langButton.click();

    // Button should now show Hebrew text
    await expect(langButton).toHaveText('עב');

    // English subtitle should appear
    await expect(page.getByText('Find shelters along your route')).toBeVisible({ timeout: 5000 });

    // The app direction should change to LTR
    const appDiv = page.locator('.app');
    await expect(appDiv).toHaveAttribute('dir', 'ltr');
  });

  test('toggle language back to Hebrew', async ({ page }) => {
    await page.goto('/');

    const langButton = page.locator('.lang-toggle-btn');
    await expect(langButton).toBeVisible({ timeout: 10000 });

    // Switch to English
    await langButton.click();
    await expect(langButton).toHaveText('עב');

    // Switch back to Hebrew
    await langButton.click();
    await expect(langButton).toHaveText('EN');
    await expect(page.getByText('מצא מקלטים לאורך המסלול שלך')).toBeVisible({ timeout: 5000 });

    const appDiv = page.locator('.app');
    await expect(appDiv).toHaveAttribute('dir', 'rtl');
  });

  test('toggle theme cycles through light, dark, high-contrast', async ({ page }) => {
    await page.goto('/');

    const themeButton = page.locator('.theme-toggle-btn');
    await expect(themeButton).toBeVisible({ timeout: 10000 });

    const appDiv = page.locator('.app');

    // Click to cycle to dark mode
    await themeButton.click();
    await expect(appDiv).toHaveAttribute('data-theme', 'dark', { timeout: 3000 });

    // Click to cycle to high-contrast
    await themeButton.click();
    await expect(appDiv).toHaveAttribute('data-theme', 'high-contrast', { timeout: 3000 });

    // Click to cycle back to light
    await themeButton.click();
    await expect(appDiv).toHaveAttribute('data-theme', 'light', { timeout: 3000 });
  });

  test('expand and collapse search panel on mobile', async ({ browser }) => {
    // Panel handle is only visible on mobile viewports
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/');

    const panelHandle = page.locator('.panel-handle');
    await expect(panelHandle).toBeVisible({ timeout: 10000 });

    const searchPanel = page.locator('.search-panel');

    // Check initial state - panel should have one of the classes
    const initialExpanded = await searchPanel.evaluate(
      (el) => el.classList.contains('panel-expanded')
    );

    // Click to toggle
    await panelHandle.click();

    if (initialExpanded) {
      // Was expanded, should now be collapsed
      await expect(searchPanel).toHaveClass(/panel-collapsed/, { timeout: 3000 });
    } else {
      // Was collapsed, should now be expanded
      await expect(searchPanel).toHaveClass(/panel-expanded/, { timeout: 3000 });
    }

    // Click again to toggle back
    await panelHandle.click();

    if (initialExpanded) {
      await expect(searchPanel).toHaveClass(/panel-expanded/, { timeout: 3000 });
    } else {
      await expect(searchPanel).toHaveClass(/panel-collapsed/, { timeout: 3000 });
    }

    await context.close();
  });
});

import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

const familyRemoteUrl = (process.env.VITE_FAMILY_REMOTE_URL ?? '').trim();

async function createAppContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
  });
  return context;
}

async function openApp(page: Page, path = '/?familySyncMode=hybrid'): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.getByLabel('Select language').selectOption('en');
  await expect(page.locator('.app')).toHaveAttribute('dir', 'ltr');
}

async function openFamilySection(page: Page): Promise<void> {
  await page.locator('.app-section-nav').getByRole('button', { name: 'Family' }).click();
  await expect(page.locator('.app-section-panel[aria-label="Family"]')).toBeVisible();
  await expect(page.locator('.family-safety-content')).toBeVisible();
}

async function expectRemoteMemberCount(
  request: APIRequestContext,
  groupCode: string,
  expectedCount: number
): Promise<void> {
  await expect.poll(async () => {
    const response = await request.get(`${familyRemoteUrl}/${groupCode}`);
    if (!response.ok()) {
      return `status:${response.status()}`;
    }

    const payload = await response.json() as { members?: unknown[] };
    return payload.members?.length ?? 0;
  }, {
    timeout: 20000,
  }).toBe(expectedCount);
}

async function expectRemoteMember(
  request: APIRequestContext,
  groupCode: string,
  predicate: (member: { id: string; userId?: string; deviceId?: string; name: string }) => boolean
): Promise<{ id: string; userId?: string; deviceId?: string; name: string }> {
  let matchedMember: { id: string; userId?: string; deviceId?: string; name: string } | null = null;

  await expect.poll(async () => {
    const response = await request.get(`${familyRemoteUrl}/${groupCode}`);
    if (!response.ok()) {
      return 'missing';
    }

    const payload = await response.json() as {
      members?: Array<{ id: string; userId?: string; deviceId?: string; name: string }>;
    };
    matchedMember = payload.members?.find(predicate) ?? null;
    return matchedMember?.id ?? 'missing';
  }, {
    timeout: 20000,
  }).not.toBe('missing');

  return matchedMember as { id: string; userId?: string; deviceId?: string; name: string };
}

test.describe('family sync backend', () => {
  test.skip(!familyRemoteUrl, 'requires VITE_FAMILY_REMOTE_URL');

  test('syncs family membership and safety state across two browser sessions', async ({ browser, request }) => {
    const ownerContext = await createAppContext(browser);
    const joinerContext = await createAppContext(browser);
    const ownerPage = await ownerContext.newPage();
    const joinerPage = await joinerContext.newPage();

    try {
      await openApp(ownerPage);
      await openFamilySection(ownerPage);

      await ownerPage.getByPlaceholder('Your name...').fill('Dana E2E');
      await ownerPage.getByRole('button', { name: 'Create Group' }).click();
      await expect(ownerPage.getByText('Invite family')).toBeVisible();

      const groupCode = (await ownerPage.locator('.family-safety-code-value').textContent())?.trim();
      expect(groupCode).toBeTruthy();

      await expectRemoteMemberCount(request, groupCode as string, 1);

      await openApp(joinerPage, `/?familySyncMode=hybrid&familyGroup=${groupCode}`);
      await openFamilySection(joinerPage);
      await expect(joinerPage.getByRole('tab', { name: 'Join' })).toHaveAttribute('aria-selected', 'true');
      await expect(joinerPage.getByPlaceholder('Group code (6 chars)')).toHaveValue(groupCode as string);

      await joinerPage.getByPlaceholder('Your name...').fill('Noam E2E');
      await joinerPage.getByRole('button', { name: 'Join' }).click();
      await expect(joinerPage.getByText('Invite family')).toBeVisible();

      await expectRemoteMemberCount(request, groupCode as string, 2);

      await ownerPage.reload({ waitUntil: 'networkidle' });
      await ownerPage.getByLabel('Select language').selectOption('en');
      await openFamilySection(ownerPage);
      await expect(ownerPage.locator('.family-safety-member')).toHaveCount(2);
      await expect(ownerPage.locator('.family-safety-member-name')).toContainText(['Noam E2E', 'Dana E2E']);

      await joinerPage.getByRole('button', { name: "I'm Safe!" }).click();
      await expect(joinerPage.getByRole('button', { name: 'Marked as Safe' })).toBeVisible();

      await expect.poll(async () => {
        const response = await request.get(`${familyRemoteUrl}/${groupCode}`);
        if (!response.ok()) {
          return 'missing';
        }

        const payload = await response.json() as {
          members: Array<{ name: string; status: string }>;
        };
        return payload.members.find((member) => member.name === 'Noam E2E')?.status ?? 'missing';
      }, {
        timeout: 20000,
      }).toBe('safe');

      await ownerPage.reload({ waitUntil: 'networkidle' });
      await ownerPage.getByLabel('Select language').selectOption('en');
      await openFamilySection(ownerPage);
      await expect(ownerPage.getByText('1 safe')).toBeVisible();

      await joinerPage.getByRole('button', { name: 'Leave Group' }).click();
      await expect(joinerPage.getByPlaceholder('Your name...')).toBeVisible();

      await expectRemoteMemberCount(request, groupCode as string, 1);

      await ownerPage.reload({ waitUntil: 'networkidle' });
      await ownerPage.getByLabel('Select language').selectOption('en');
      await openFamilySection(ownerPage);
      await expect(ownerPage.locator('.family-safety-member')).toHaveCount(1);
      await expect(ownerPage.locator('.family-safety-member-name')).toContainText(['Dana E2E']);

      await ownerPage.getByRole('button', { name: 'Leave Group' }).click();
      await expect(ownerPage.getByPlaceholder('Your name...')).toBeVisible();

      await expect.poll(async () => {
        const response = await request.get(`${familyRemoteUrl}/${groupCode}`);
        return response.status();
      }, {
        timeout: 20000,
      }).toBe(404);
    } finally {
      await ownerContext.close();
      await joinerContext.close();
    }
  });

  test('reuses the authenticated member identity when the same user rejoins from another device', async ({ browser, request }) => {
    const ownerContext = await createAppContext(browser);
    const rejoinContext = await createAppContext(browser);
    const ownerPage = await ownerContext.newPage();
    const rejoinPage = await rejoinContext.newPage();
    const ownerPath = '/?familySyncMode=hybrid&familyRemoteAuthState=authenticated&familyRemoteUserId=user-123';

    try {
      await openApp(ownerPage, ownerPath);
      await openFamilySection(ownerPage);

      await ownerPage.getByPlaceholder('Your name...').fill('Dana Auth');
      await ownerPage.getByRole('button', { name: 'Create Group' }).click();
      await expect(ownerPage.getByText('Invite family')).toBeVisible();

      const groupCode = (await ownerPage.locator('.family-safety-code-value').textContent())?.trim();
      expect(groupCode).toBeTruthy();

      await expectRemoteMemberCount(request, groupCode as string, 1);
      const ownerMember = await expectRemoteMember(request, groupCode as string, (member) => member.userId === 'user-123');
      expect(ownerMember.deviceId).toBeTruthy();

      const rejoinPath = `/?familySyncMode=hybrid&familyGroup=${groupCode}&familyRemoteAuthState=authenticated&familyRemoteUserId=user-123`;
      await openApp(rejoinPage, rejoinPath);
      await openFamilySection(rejoinPage);
      await expect(rejoinPage.getByRole('tab', { name: 'Join' })).toHaveAttribute('aria-selected', 'true');
      await expect(rejoinPage.getByPlaceholder('Group code (6 chars)')).toHaveValue(groupCode as string);

      await rejoinPage.getByPlaceholder('Your name...').fill('Dana Auth');
      await rejoinPage.getByRole('button', { name: 'Join' }).click();
      await expect(rejoinPage.getByText('Invite family')).toBeVisible();

      await expectRemoteMemberCount(request, groupCode as string, 1);
      const rebasedMember = await expectRemoteMember(
        request,
        groupCode as string,
        (member) => member.userId === 'user-123' && member.deviceId !== ownerMember.deviceId
      );
      expect(rebasedMember.id).toBe(ownerMember.id);
      expect(rebasedMember.deviceId).toBeTruthy();
      expect(rebasedMember.deviceId).not.toBe(ownerMember.deviceId);

      await ownerPage.reload({ waitUntil: 'networkidle' });
      await ownerPage.getByLabel('Select language').selectOption('en');
      await openFamilySection(ownerPage);
      await expect(ownerPage.locator('.family-safety-member')).toHaveCount(1);
      await expect(ownerPage.locator('.family-safety-member-name')).toContainText(['Dana Auth']);

      await rejoinPage.getByRole('button', { name: 'Leave Group' }).click();
      await expect(rejoinPage.getByPlaceholder('Your name...')).toBeVisible();

      await expect.poll(async () => {
        const response = await request.get(`${familyRemoteUrl}/${groupCode}`);
        return response.status();
      }, {
        timeout: 20000,
      }).toBe(404);
    } finally {
      await ownerContext.close();
      await rejoinContext.close();
    }
  });
});

import { expect, test } from '@playwright/test';

test('creates and approves a campaign from a plain-language request', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'What would you like to market today?' })).toBeVisible();

  const request = page.getByRole('textbox', { name: 'Campaign request' });
  await request.fill('Promote our Sunday brunch and get more bookings');
  await page.getByRole('button', { name: 'Send campaign request' }).click();

  await expect(page.getByTestId('campaign-preview')).toBeVisible();
  await expect(page.getByText('Sunday Brunch Promotion')).toBeVisible();

  await page.getByRole('button', { name: 'Approve campaign' }).click();
  await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible();
  await expect(page.getByText(/Publishing remains disabled/)).toBeVisible();
});

test('allows channels to be toggled without triggering other actions', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Get more bookings').click();

  const emailToggle = page.getByRole('checkbox', { name: 'Toggle Email' });
  await expect(emailToggle).not.toBeChecked();
  await emailToggle.check();
  await expect(emailToggle).toBeChecked();
});

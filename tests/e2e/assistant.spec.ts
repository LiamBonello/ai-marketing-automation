import { expect, test } from '@playwright/test';

test('creates and approves a campaign from a plain-language request', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'What would you like to market today?' })).toBeVisible();

  const request = page.getByLabel('Campaign request');
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
  await page.getByRole('button', { name: 'Get more bookings' }).click();
  await expect(page.getByTestId('campaign-preview')).toBeVisible();

  const emailToggle = page.getByLabel('Toggle Email');
  await expect(emailToggle).not.toBeChecked();
  await emailToggle.check();
  await expect(emailToggle).toBeChecked();
});

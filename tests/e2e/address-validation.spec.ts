import { test, expect } from '@playwright/test';

// Validates that invalid address does not trigger data fetch and shows an error

test.describe('Address validation', () => {
  test('shows error and prevents submit on invalid address', async ({ page }) => {
    await page.goto('/');

    const input = page.getByTestId('address-input');

    await input.waitFor({ state: 'visible' });
    await input.fill('abc');

    await page.getByTestId('search-button').click();

    await expect(page.getByText('Некорректный адрес')).toBeVisible();

    // Tabs should not be visible because submittedAddress wasn't set
    await expect(page.locator('[data-testid="tab-nfts"]')).toHaveCount(0);
  });
});

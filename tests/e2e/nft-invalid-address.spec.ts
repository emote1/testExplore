import { test, expect } from '@playwright/test';

// Ensures that entering an invalid address does NOT trigger NFTs loading
// and that no Sqwid collections requests are made.

test.describe('NFTs with invalid address', () => {
  test('does not load collections and makes no Sqwid calls', async ({ page }) => {
    await page.goto('/');

    // Track any calls to Sqwid collections-by-owner endpoints
    let sqwidCalls = 0;
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (/collections\/owner|get\/collections\/owner/i.test(url)) {
        sqwidCalls += 1;
      }
      return route.continue();
    });

    // Enter invalid address and submit
    await page.getByTestId('address-input').fill('invalid-address-xyz');
    await page.getByTestId('search-button').click();

    // Expect validation message
    await expect(page.getByText('Некорректный адрес')).toBeVisible();

    // NFTs tab should not even render since submittedAddress cleared,
    // but if it does render, switching to it must not show collections.
    const nftsTab = page.getByTestId('tab-nfts');
    if (await nftsTab.isVisible().catch(() => false)) {
      await nftsTab.click();
      // Collections title should NOT appear
      await expect(page.getByTestId('collections-title')).toHaveCount(0);
      // No collection cards should be present
      await expect(page.getByTestId('collection-card')).toHaveCount(0);
    }

    // Allow brief time for potential accidental fetches
    await page.waitForTimeout(800);

    // Ensure no Sqwid calls happened
    expect(sqwidCalls).toBe(0);
  });
});

import { test, expect } from '@playwright/test';

// Verifies: no 'Overview' label in NFT gallery header (overview state)
// and 'Back to Overview' button remains when a collection is opened.

test.describe('NFT Gallery header', () => {
  test('header has no Overview label; Back to Overview button persists', async ({ page }) => {
    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    await page.goto('/');

    // Fill address and search
    await page.getByTestId('address-input').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('address-input').fill(userAddress!);
    await page.getByTestId('search-button').click();

    // Switch to NFTs tab
    const nftsTab = page.getByTestId('tab-nfts');
    await nftsTab.scrollIntoViewIfNeeded();
    await expect(nftsTab).toBeVisible({ timeout: 15000 });
    await nftsTab.click();

    // Wait for owner collections to load (Sqwid API) and ensure overview is displayed
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForResponse((resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(), { timeout: 30000 }).catch(() => {});
    await expect(page.getByTestId('collections-title')).toBeVisible({ timeout: 30000 });

    // Header should not contain the word 'Overview' in overview state
    const header = page.getByTestId('nft-header');
    await expect(header).toBeVisible();
    await expect(header).not.toContainText(/overview/i);

    // Open first collection
    const firstCard = page.getByTestId('collection-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible({ timeout: 30000 });
    await firstCard.click();

    // Expect Back to Overview button present and correctly labeled
    const backBtn = page.getByTestId('back-to-collections');
    await expect(backBtn).toBeVisible({ timeout: 30000 });
    await expect(backBtn).toContainText('Back to Overview');
  });
});

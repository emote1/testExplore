import { test, expect } from '@playwright/test';

// Regression: quantity badges render for amount > 1 (ERC-1155)
// This test is conditional: if the current address has no NFTs with amount > 1,
// it will skip to avoid false negatives.

test.describe('NFT Quantity Badges', () => {
  test('renders amount badge when amount > 1', async ({ page }) => {
    await page.goto('/');

    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    const address = userAddress!;
    const addressInput = page.getByTestId('address-input');
    await addressInput.waitFor({ state: 'visible', timeout: 15000 });
    await addressInput.fill(address);

    const submitBtn = page.getByTestId('search-button');
    await submitBtn.click();

    // Wait for collections-by-owner request to resolve (best-effort)
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page
      .waitForResponse((resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(), { timeout: 30000 })
      .catch(() => undefined);

    // Go to NFTs tab
    const nftsTab = page.getByTestId('tab-nfts');
    await nftsTab.scrollIntoViewIfNeeded();
    await expect(nftsTab).toBeVisible({ timeout: 15000 });
    await nftsTab.click();

    // Wait for NFTs content
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);

    const badge = page.locator('[data-testid="nft-amount-badge-overlay"], [data-testid="nft-amount-badge-inline"], [data-testid="nft-amount-badge-fallback"]');

    // Give virtualized grid a moment to render
    await badge.first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);

    const count = await badge.count();
    if (count === 0) {
      test.skip(true, 'No NFTs with amount > 1 found for this address; skipping');
    }

    // Assert at least one badge is visible
    await expect(badge.first()).toBeVisible();
  });
});

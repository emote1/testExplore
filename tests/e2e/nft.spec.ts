import { test, expect } from '@playwright/test';

// Basic smoke e2e covering NFTs flow

test.describe('NFT Gallery', () => {
  test('loads home and navigates to NFTs, collections appear, open a collection', async ({ page }) => {
    await page.goto('/');

    // Require user address via env var
    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    // Fill the address input (stable test id)
    const address = userAddress!; // safe due to skip guard above
    const addressInput = page.getByTestId('address-input');
    await addressInput.waitFor({ state: 'visible', timeout: 15000 });
    await addressInput.fill(address);

    // Submit: click a button or press Enter
    const submitBtn = page.getByTestId('search-button');
    await submitBtn.click();
    // Wait for data to load after submitting address
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    // Additionally, wait for Sqwid collections-by-owner API to resolve
    await page.waitForResponse(
      (resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(),
      { timeout: 30000 }
    ).catch(() => {});

    // Navigate to NFTs tab via test id
    const nftsTab = page.getByTestId('tab-nfts');
    await nftsTab.scrollIntoViewIfNeeded();
    await expect(nftsTab).toBeVisible({ timeout: 15000 });
    await expect(nftsTab).toBeEnabled();
    await nftsTab.click();
    // Wait for NFTs tab content to load
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForResponse(
      (resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(),
      { timeout: 30000 }
    ).catch(() => {});

    // Collections title should be visible
    await expect(page.getByTestId('collections-title')).toBeVisible({ timeout: 20000 });

    // Click first collection card by test id
    const firstCard = page.getByTestId('collection-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible({ timeout: 30000 });
    await firstCard.click();

    // After opening a collection, wait for collection toolbar to appear via test ids
    await Promise.race([
      page.getByTestId('back-to-collections').waitFor({ state: 'visible', timeout: 30000 }),
      page.getByTestId('items-per-page').waitFor({ state: 'visible', timeout: 30000 })
    ]);
  });
});

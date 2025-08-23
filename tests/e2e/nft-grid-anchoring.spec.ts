import { test, expect } from '@playwright/test';

// Ensures the virtualized NFT grid is anchored just below the header after opening a collection

test.describe('NFT Grid anchoring', () => {
  test('grid anchors below header when a collection is opened', async ({ page }) => {
    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    await page.goto('/');

    // Fill address and search
    await page.getByTestId('address-input').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('address-input').fill(userAddress!);
    await page.getByTestId('search-button').click();

    // Wait for collections to load (owner collections via Sqwid)
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page
      .waitForResponse((resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(), { timeout: 30000 })
      .catch(() => undefined);

    // Switch to NFTs tab
    const nftsTab = page.getByTestId('tab-nfts');
    await nftsTab.scrollIntoViewIfNeeded();
    await expect(nftsTab).toBeVisible({ timeout: 15000 });
    await nftsTab.click();

    // Switch to Collections overview (default overview tab is 'video')
    const collectionsTab = page.getByTestId('tab-collections');
    await expect(collectionsTab).toBeVisible({ timeout: 15000 });
    await collectionsTab.click();

    // Ensure overview visible
    await expect(page.getByTestId('collections-title')).toBeVisible({ timeout: 30000 });

    // Open first collection
    const firstCard = page.getByTestId('collection-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible({ timeout: 30000 });
    await firstCard.click();

    // Wait for header and grid to appear
    const header = page.getByTestId('nft-header');
    const grid = page.getByTestId('nft-grid');
    await expect(header).toBeVisible({ timeout: 30000 });
    await expect(grid).toBeVisible({ timeout: 30000 });

    // Wait for at least one virtual row to render (row wrappers are direct children of the inner relative container)
    const firstRow = page.locator('[data-testid="nft-grid"] > div > div').first();
    await firstRow.waitFor({ state: 'visible', timeout: 30000 });

    const headerBox = await header.boundingBox();
    const rowBox = await firstRow.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(rowBox).toBeTruthy();

    // The first row should start just below the header (allow some spacing from margins/paddings)
    const delta = rowBox!.y - (headerBox!.y + headerBox!.height);
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThan(120);
  });
});

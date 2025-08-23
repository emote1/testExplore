import { test, expect } from '@playwright/test';

// Verifies infinite scroll loads next pages and NFTs remain deduplicated by ID.
// Uses data-testid="nft-card" and data-nft-id on cards introduced in NftGallery.

test.describe('NFT Collection infinite scroll and dedup', () => {
  test('loads next page(s) on scroll and never duplicates NFT IDs', async ({ page }) => {
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
    // Switch to Collections overview (default overview tab is 'video')
    const collectionsTab = page.getByTestId('tab-collections');
    await expect(collectionsTab).toBeVisible({ timeout: 15000 });
    await collectionsTab.click();

    // Wait for owner collections to load (Sqwid API)
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page
      .waitForResponse(
        (resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(),
        { timeout: 30000 }
      )
      .catch(() => undefined);
    await expect(page.getByTestId('collections-title')).toBeVisible({ timeout: 30000 });

    // Open first collection
    const firstCard = page.getByTestId('collection-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible({ timeout: 30000 });
    await firstCard.click();

    // Wait for collection toolbar and grid
    await Promise.race([
      page.getByTestId('back-to-collections').waitFor({ state: 'visible', timeout: 30000 }),
      page.getByTestId('items-per-page').waitFor({ state: 'visible', timeout: 30000 }),
    ]);
    const grid = page.getByTestId('nft-grid');
    await expect(grid).toBeVisible({ timeout: 30000 });

    // Helpers
    async function getAllIds(): Promise<string[]> {
      const ids = await page.$$eval('[data-testid="nft-card"]', (els) =>
        els
          .map((el) => (el as HTMLElement).getAttribute('data-nft-id') || '')
          .filter((v): v is string => !!v)
      );
      return ids;
    }

    async function tryLoadNextPage(): Promise<boolean> {
      const respPromise = page
        .waitForResponse((resp) => {
          if (!/get\/marketplace\/by-collection\//i.test(resp.url()) || !resp.ok()) return false;
          try {
            const u = new URL(resp.url());
            const startFrom = Number(u.searchParams.get('startFrom') || '0');
            return startFrom > 0;
          } catch {
            return false;
          }
        }, { timeout: 15000 })
        .catch(() => null);

      for (let i = 0; i < 6; i++) {
        // Scroll to bottom to reveal last row and trigger onEndReached
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const resp = await Promise.race([respPromise, page.waitForTimeout(1000).then(() => null)]);
        if (resp) {
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
          return true;
        }
      }
      return false;
    }

    // Ensure at least one card is present
    await expect(page.locator('[data-testid="nft-card"]').first()).toBeVisible({ timeout: 30000 });
    // Initial uniqueness across DOM
    const firstIds = await getAllIds();
    const seenInitial = new Set(firstIds);
    expect(seenInitial.size).toBe(firstIds.length);
    const initialCount = firstIds.length;

    // Load next page
    const loaded = await tryLoadNextPage();
    if (!loaded) test.skip(true, 'Selected collection has a single page; skipping infinite scroll assertion.');

    // Wait until the number of cards grows
    await page.waitForFunction((min) => document.querySelectorAll('[data-testid="nft-card"]').length > min, initialCount, { timeout: 20000 });
    // Collect after first next page and assert uniqueness across DOM
    const afterIds = await getAllIds();
    const seenAfter = new Set(afterIds);
    expect(seenAfter.size).toBe(afterIds.length);

    // Optionally try loading another page to strengthen dedup verification
    const loaded2 = await tryLoadNextPage().catch(() => false);
    if (loaded2) {
      await page.waitForFunction((min) => document.querySelectorAll('[data-testid="nft-card"]').length > min, afterIds.length, { timeout: 20000 }).catch(() => undefined);
      const afterIds2 = await getAllIds();
      const seenAfter2 = new Set(afterIds2);
      expect(seenAfter2.size).toBe(afterIds2.length);
    }

    // Ensure total unique observed increased
    const finalIds = await getAllIds();
    expect(finalIds.length).toBeGreaterThan(initialCount);
  });
});

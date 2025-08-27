import { test, expect } from '@playwright/test';

// Ensures that when NFTs tab is active, transactions GraphQL is not queried

test.describe('ViewMode optimization', () => {
  test('no transactions GraphQL when NFTs tab is active', async ({ page }) => {
    test.skip(!process.env.E2E_USER_ADDRESS, 'Set E2E_USER_ADDRESS to a valid Reef address');

    const address = process.env.E2E_USER_ADDRESS!;

    let txGraphqlCalls = 0; // transfersConnection only
    let txAnyCalls = 0;     // transfersConnection OR transfers
    await page.route('**/graphql', async (route) => {
      const postData = route.request().postData() || '';
      if (postData.includes('transfersConnection')) {
        txGraphqlCalls += 1;
      }
      if (postData.includes('transfersConnection') || /\btransfers\b/.test(postData)) {
        txAnyCalls += 1;
      }
      // Let requests pass through
      await route.continue();
    });

    await page.goto('/');

    const input = page
      .getByRole('textbox', { name: /address|account|wallet/i })
      .or(page.locator('input[placeholder*="address" i]'))
      .or(page.locator('input[name*="address" i]'));

    await input.fill(address);
    await page.getByRole('button', { name: /^search$/i }).click();

    // Switch to NFTs and ensure it's active
    const nftsTab = page.getByTestId('tab-nfts');
    await nftsTab.click();
    await expect(nftsTab).toHaveClass(/border-blue-600/);

    // One initial tx request may have fired in the short window after submit.
    // Reset the counter now that NFTs tab is active and ensure no further calls occur while in NFTs.
    txGraphqlCalls = 0;
    txAnyCalls = 0;

    // Wait a bit to catch possible polling
    await page.waitForTimeout(1500);

    // Expect no tx GraphQL calls since NFTs active
    expect(txGraphqlCalls).toBe(0);

    // Switch back to Transactions
    const txTab = page.getByRole('button', { name: /transactions/i });
    await txTab.click();
    // Now we should see at least one tx query being fired; accept either transfersConnection or transfers; allow more time for WebKit
    const txReqSeen = await Promise.race([
      page
        .waitForRequest(
          (req) => {
            if (!req.url().includes('/graphql')) return false;
            const body = req.postData() || '';
            return body.includes('transfersConnection') || /\btransfers\b/.test(body);
          },
          { timeout: 8000 }
        )
        .then(() => true)
        .catch(() => false),
      page.waitForTimeout(8000).then(() => false),
    ]);
    if (!txReqSeen) {
      // Fallback: poll the counter up to ~6s more
      for (let i = 0; i < 12 && txAnyCalls < 1; i++) {
        await page.waitForTimeout(500);
      }
    }
    expect(Math.max(txGraphqlCalls, txAnyCalls)).toBeGreaterThanOrEqual(1);
  });
});

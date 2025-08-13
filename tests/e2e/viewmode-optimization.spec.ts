import { test, expect } from '@playwright/test';

// Ensures that when NFTs tab is active, transactions GraphQL is not queried

test.describe('ViewMode optimization', () => {
  test('no transactions GraphQL when NFTs tab is active', async ({ page }) => {
    test.skip(!process.env.E2E_USER_ADDRESS, 'Set E2E_USER_ADDRESS to a valid Reef address');

    const address = process.env.E2E_USER_ADDRESS!;

    let txGraphqlCalls = 0;
    await page.route('**/graphql', async (route) => {
      const postData = route.request().postData() || '';
      if (postData.includes('transfersConnection')) {
        txGraphqlCalls += 1;
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

    // Switch to NFTs
    await page.getByTestId('tab-nfts').click();

    // One initial tx request may have fired in the short window after submit.
    // Reset the counter now that NFTs tab is active and ensure no further calls occur while in NFTs.
    txGraphqlCalls = 0;

    // Wait a bit to catch possible polling
    await page.waitForTimeout(1500);

    // Expect no tx GraphQL calls since NFTs active
    expect(txGraphqlCalls).toBe(0);

    // Switch back to Transactions
    await page.getByRole('button', { name: /transactions/i }).click();

    // Now we should see at least one tx query being fired
    await page.waitForTimeout(1200);
    expect(txGraphqlCalls).toBeGreaterThanOrEqual(1);
  });
});

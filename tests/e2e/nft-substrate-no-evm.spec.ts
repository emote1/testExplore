import { test, expect } from '@playwright/test';

// If a Substrate (SS58) address is entered, NFTs cannot exist without EVM mapping
// We expect an informational notice and no Sqwid collections calls.

test('substrate address shows requires-evm notice and no Sqwid calls', async ({ page }) => {
  await page.goto('/');

  // Count any calls to Sqwid collections endpoints
  let sqwidCalls = 0;
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/collections\/owner|get\/collections\/owner/i.test(url)) {
      sqwidCalls += 1;
    }
    return route.continue();
  });

  // A plausible SS58 address format (not necessarily existing)
  const substrateAddr = '5FfC9kQ8x1JvVjv7kG9pT6wQ2S2p2VqfQp9tq2w6rKqKQx1T';
  await page.getByTestId('address-input').fill(substrateAddr);
  await page.getByTestId('search-button').click();

  // Go to NFTs tab
  await page.getByTestId('tab-nfts').click();

  // Expect the EVM-required notice and helper text
  const evmNotice = page.getByTestId('nft-requires-evm');
  await expect(evmNotice).toBeVisible();
  await expect(evmNotice).toContainText('No NFTs available: the provided address is not EVM-mapped.');
  await expect(evmNotice).toContainText('Bind an EVM address in your Reef wallet to view NFTs.');

  // Allow small buffer and then ensure no Sqwid calls were made
  await page.waitForTimeout(600);
  expect(sqwidCalls).toBe(0);
});

import { test, expect } from '@playwright/test';

// Live Rewards E2E (no GraphQL mocking)
// Requires: set E2E_REWARDS_NATIVE_ADDRESS to a native Reef address that has rewards

test.describe('Rewards tab (live)', () => {
  test('shows rewards for provided native address', async ({ page }) => {
    const nativeAddress = process.env.E2E_REWARDS_NATIVE_ADDRESS;
    if (!nativeAddress) {
      test.skip(true, 'Set E2E_REWARDS_NATIVE_ADDRESS to a Reef native address with rewards');
    }

    await page.goto('/');

    const input = page.getByTestId('address-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(nativeAddress!);
    await page.getByTestId('search-button').click();

    const rewardsTab = page.getByTestId('tab-rewards');
    await rewardsTab.waitFor({ state: 'visible', timeout: 30000 });
    await rewardsTab.click();

    await expect(page.getByText('Staking Rewards')).toBeVisible({ timeout: 30000 });
    // Wait for any network to settle
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);

    // Expect at least one row or an external extrinsic link
    const externalLink = page.locator('a[href^="https://reefscan.com/extrinsic/"]').first();
    const hasLink = await externalLink.isVisible().catch(() => false);
    if (!hasLink) {
      // Fallback: count table rows>0
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThan(0);
    } else {
      await expect(externalLink).toBeVisible();
    }
  });
});

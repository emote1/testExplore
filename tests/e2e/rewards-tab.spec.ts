import { test, expect, Page, Route, Request } from '@playwright/test';

const GRAPHQL_URL_PART = 'squid.subsquid.io/reef-explorer/graphql';
const INPUT_ADDR = '5ED6qi9u8KMtjw7ve4MDPQY92s1FEbKdG3nvjupkhg5hhiVx';

type MockMode = 'full' | 'empty';

function parseOp(req: Request): { op?: string; vars?: any } {
  try {
    const body: any = req.postDataJSON();
    return { op: body?.operationName as string | undefined, vars: body?.variables };
  } catch {
    return {};
  }
}

function makeRewards(count: number, accountId: string, offset = 0) {
  const baseTs = '2024-01-01T00:00:00.000Z';
  return Array.from({ length: count }, (_, i) => {
    const idx = offset + i + 1;
    return {
      id: `staking_${idx}`,
      amount: String(1_000_000_000_000_000_000n + BigInt(idx)), // 1 REEF + idx in wei
      timestamp: baseTs,
      signer: { id: accountId },
      event: {
        index: idx,
        block: { height: 1000 + idx },
        extrinsic: {
          id: `extrinsic_${idx}`,
          hash: `0xreef${idx.toString(16).padStart(6, '0')}`,
          index: idx,
          signedData: null,
          __typename: 'Extrinsic',
        },
        __typename: 'Event',
      },
      __typename: 'Staking',
    };
  });
}

async function installGraphqlMock(page: Page, mode: MockMode) {
  await page.route(`**${GRAPHQL_URL_PART}`, async (route: Route, req: Request) => {
    if (req.method() !== 'POST') return route.fallback();

    const { op, vars } = parseOp(req);

    // Address resolver responses
    if (op === 'GetAccountByEvm' || op === 'GetAccountByNative') {
      const id = mode === 'empty' ? 'MOCK_EMPTY' : 'NATIVE_1';
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { accounts: [{ id, evmAddress: '0x1234' }] } }),
      });
    }

    // Rewards: totalCount
    if (op === 'StakingConnectionQuery') {
      const totalCount = mode === 'empty' ? 0 : 30;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { stakingsConnection: { totalCount } } }),
      });
    }

    // Rewards: paginated list
    if (op === 'StakingListQuery') {
      const accountId: string = vars?.accountId ?? (mode === 'empty' ? 'MOCK_EMPTY' : 'NATIVE_1');
      const limit: number = Number(vars?.first ?? 25);
      const offset: number = Number(vars?.after ?? 0);

      const total = mode === 'empty' ? 0 : 30;
      const remaining = Math.max(0, total - offset);
      const pageSize = Math.min(limit, remaining);
      const items = pageSize > 0 ? makeRewards(pageSize, accountId, offset) : [];

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { stakings: items } }),
      });
    }

    // Default: empty data to avoid external calls in CI
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });
}

test.describe('Rewards tab', () => {
  test('shows paginated rewards list and external links', async ({ page }) => {
    await installGraphqlMock(page, 'full');
    await page.goto('/');

    const input = page.getByTestId('address-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(INPUT_ADDR);
    await page.getByTestId('search-button').click();

    const rewardsTab = page.getByTestId('tab-rewards');
    await rewardsTab.waitFor({ state: 'visible', timeout: 30000 });
    await rewardsTab.click();

    await expect(page.getByText('Staking Rewards')).toBeVisible();

    // First page (25 of 30): wait until data rows are rendered (detect by presence of external link)
    await expect(page.locator('a[href^="https://reefscan.com/extrinsic/"]').first()).toBeVisible({ timeout: 30000 });
    const rowsPage1 = await page.locator('tbody tr').count();
    expect(rowsPage1).toBe(25);

    // Next page (5 of 30)
    await page.getByRole('button', { name: 'Next' }).click();
    const rowsPage2 = await page.locator('tbody tr').count();
    expect(rowsPage2).toBe(5);

    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  test('shows empty state when no rewards found', async ({ page }) => {
    await installGraphqlMock(page, 'empty');
    await page.goto('/');

    const input = page.getByTestId('address-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(INPUT_ADDR);
    await page.getByTestId('search-button').click();

    const rewardsTab = page.getByTestId('tab-rewards');
    await rewardsTab.waitFor({ state: 'visible', timeout: 30000 });
    await rewardsTab.click();

    await expect(page.getByText('No rewards found for this address.')).toBeVisible({ timeout: 30000 });
  });
});

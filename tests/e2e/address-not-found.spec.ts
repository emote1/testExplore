import { test, expect, Page, Route, Request } from '@playwright/test';

const GRAPHQL_URL_PART = 'squid.subsquid.io/reef-explorer/graphql';
const EVM_ADDR = '5ED6qi9u8KMtjw7ve4MDPQY92s1FEbKdG3nvjupkhg5hhiVx';

function parseOp(req: Request): { op?: string; vars?: any } {
  try {
    const body: any = req.postDataJSON();
    return { op: body?.operationName as string | undefined, vars: body?.variables };
  } catch {
    return {};
  }
}

async function installGraphqlMock(page: Page) {
  await page.route(`**${GRAPHQL_URL_PART}`, async (route: Route, req: Request) => {
    if (req.method() !== 'POST') return route.fallback();

    const { op } = parseOp(req);

    if (op === 'GetAccountByEvm') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { accounts: [] } }),
      });
    }
    if (op === 'GetAccountByNative') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { accounts: [] } }),
      });
    }

    // Avoid external requests: fulfill unknown ops with empty data
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}

test.describe('Address resolution', () => {
  test('shows error when address not found', async ({ page }) => {
    await installGraphqlMock(page);
    await page.goto('/');

    const input = page.getByTestId('address-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(EVM_ADDR);

    await page.getByTestId('search-button').click();

    await expect(page.getByTestId('address-error')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="tab-nfts"]')).toHaveCount(0);
  });
});

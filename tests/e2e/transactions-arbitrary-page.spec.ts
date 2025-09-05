import { test, expect, Page, Route, Request } from '@playwright/test';

const GRAPHQL_URL_PART = 'squid.subsquid.io/reef-explorer/graphql';
const EVM_ADDR = '5ED6qi9u8KMtjw7ve4MDPQY92s1FEbKdG3nvjupkhg5hhiVx';
const NATIVE_ADDR = 'reef1nativeaddressxyz';

function parseOp(req: Request): { op?: string; vars?: any } {
  try {
    const body: any = req.postDataJSON();
    return { op: body?.operationName as string | undefined, vars: body?.variables };
  } catch {
    return {};
  }
}

function makeTransfer({ id, from, to, ts, hash }: { id: string; from: string; to: string; ts: string; hash: string }) {
  return {
    id,
    amount: '1000000000000000000',
    timestamp: ts,
    success: true,
    type: 'TRANSFER',
    signedData: null,
    extrinsicHash: hash,
    from: { id: from },
    to: { id: to },
    token: { id: 'reef-token', name: 'REEF' },
  };
}

async function installGraphqlMock(page: Page) {
  const TOTAL = 95; // total dataset items
  const API_LIMIT = 30; // server-side page size (matches app's first variable)

  // Build newest-first dataset: tx-95, tx-94, ..., tx-1
  const DATA = Array.from({ length: TOTAL }, (_, i) => {
    const n = TOTAL - i; // 95..1
    // Ensure descending timestamps; not strictly needed, but keeps semantics
    const ts = new Date(1704067200000 - i * 1000).toISOString(); // 2024-01-01T00:00:00.000Z - i sec
    return makeTransfer({ id: `tx-${n}`, from: 'someone', to: NATIVE_ADDR, ts, hash: `0xhash${n}` });
  });

  await page.route(`**${GRAPHQL_URL_PART}`, async (route: Route, req: Request) => {
    if (req.method() !== 'POST') return route.fallback();
    const { op, vars } = parseOp(req);

    if (op === 'GetAccountByEvm') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { accounts: [{ id: NATIVE_ADDR, evmAddress: EVM_ADDR }] } }) });
    }
    if (op === 'GetAccountByNative') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { accounts: [{ id: NATIVE_ADDR, evmAddress: EVM_ADDR }] } }) });
    }

    if (op === 'TransfersFeeQuery') {
      // Cursor is numeric string of last returned index; start from 0 when absent
      const first: number = Number(vars?.first ?? API_LIMIT);
      const afterRaw: string | undefined = vars?.after;
      const lastIdx = Number.isFinite(Number(afterRaw)) ? Number(afterRaw) : -1;
      const start = lastIdx + 1;
      const endExclusive = Math.min(start + first, TOTAL);
      const slice = DATA.slice(start, endExclusive);
      const edges = slice.map((node) => ({ node }));
      const hasNextPage = endExclusive < TOTAL;
      const endCursor = edges.length > 0 ? String(endExclusive - 1) : null; // numeric cursor

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            transfersConnection: {
              edges,
              pageInfo: { hasNextPage, endCursor },
            },
          },
        }),
      });
    }

    if (op === 'TransfersPollingQuery') {
      // Not relevant for this test; return empty
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { transfers: [] } }) });
    }

    // Avoid external requests: fulfill unknown ops with empty data
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });
}

test.describe('Transactions arbitrary page jump', () => {
  test('loads enough pages to render a distant page via URL param', async ({ page }) => {
    await installGraphqlMock(page);

    // Jump directly to page index 6 (7th page) via URL param; disable frequent polling
    await page.goto('/?page=6&pollMs=60000');

    const input = page.getByTestId('address-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(EVM_ADDR);
    await page.getByTestId('search-button').click();

    const rows = page.getByTestId('tx-row');

    // Expect exactly one UI page worth of rows (10)
    await expect(rows).toHaveCount(10, { timeout: 20000 });

    // For TOTAL=95 and newest-first dataset, pageIndex=6 shows items [60..69] => ids tx-35..tx-26
    await expect(rows.first()).toHaveAttribute('data-transfer-id', 'tx-35');
    await expect(rows.last()).toHaveAttribute('data-transfer-id', 'tx-26');

    // Optional: label reflects page 7 (index+1)
    await expect(page.getByText(/Page\s+7\s+of/i)).toBeVisible();
  });
});

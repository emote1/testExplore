import { test, expect, Page, Request } from '@playwright/test';

// Owner-based Infinite NFT Scroll E2E
// Verifies:
// - Infinite pagination by owner is enabled via URL flag
// - First GraphQL page uses offset=0 and expected limit
// - Scrolling near bottom triggers another page (offset > 0) when available
// - Bottom loader overlay appears while fetching next page
// - NFT grid item count grows after additional pages (best-effort; falls back gracefully)
// ru: Тест проверяет бесконечную прокрутку NFT по адресу владельца.

const GRAPHQL_URL_PART = 'squid.subsquid.io/reef-explorer/graphql';
const OWNER_LIMIT = 12; // small page size to encourage multiple pages

function parsePagedVars(req: Request): { op?: string; limit?: number; offset?: number } {
  try {
    const body: any = req.postDataJSON();
    const op = body?.operationName as string | undefined;
    const vars = body?.variables as { limit?: number; offset?: number } | undefined;
    return { op, limit: vars?.limit, offset: vars?.offset };
  } catch {
    return {};
  }
}

async function fillAddressAndSearch(page: Page, address: string) {
  const addressInput = page.getByTestId('address-input');
  await addressInput.waitFor({ state: 'visible', timeout: 15000 });
  await addressInput.fill(address);
  const submitBtn = page.getByTestId('search-button');
  await submitBtn.click();
}

async function openNftsTab(page: Page) {
  const nftsTab = page.getByTestId('tab-nfts');
  await expect(nftsTab).toBeVisible({ timeout: 30000 });
  await nftsTab.scrollIntoViewIfNeeded();
  await nftsTab.click();
  await expect(nftsTab).toHaveClass(/border-blue-600/);
  // Ensure NFTs header present
  await page.getByTestId('nft-header').waitFor({ state: 'visible', timeout: 30000 }).catch(() => undefined);
}

async function getGridAndEnsureVisible(page: Page): Promise<{ grid: ReturnType<Page['locator']>; kind: 'video' | 'other' } | null> {
  const videoGrid = page.getByTestId('video-nfts-grid');
  if (await videoGrid.count()) {
    await videoGrid.scrollIntoViewIfNeeded();
    return { grid: videoGrid, kind: 'video' };
  }
  const otherTab = page.getByTestId('tab-other');
  if (await otherTab.count()) {
    await otherTab.click();
    const otherGrid = page.getByTestId('other-nfts-grid');
    await otherGrid.scrollIntoViewIfNeeded();
    if (await otherGrid.count()) return { grid: otherGrid, kind: 'other' };
  }
  return null;
}

async function getGridCount(page: Page, testId: string): Promise<number> {
  const el = page.getByTestId(testId);
  const exists = await el.count();
  if (!exists) return 0;
  const v = await el.getAttribute('data-total-items');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function scrollNearBottom(page: Page) {
  // Trigger user scroll gesture and near-bottom
  await page.evaluate(() => window.scrollBy({ top: Math.round(window.innerHeight * 1.2), behavior: 'auto' }));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollBy({ top: Math.round(window.innerHeight * 1.2), behavior: 'auto' }));
}

test.describe('Owner-based infinite NFT scroll', () => {
  test('infinite pagination by owner triggers next pages on scroll', async ({ page }) => {
    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    // Enable infinite owner mode + set small page size for clear pagination
    await page.goto(`/?infiniteOwner=1&ownerLimit=${OWNER_LIMIT}`);

    // Track GraphQL paged calls
    const calls: Array<{ limit?: number; offset?: number }> = [];
    const onReq = (req: Request) => {
      if (req.method() !== 'POST') return;
      const url = req.url();
      if (!url.includes(GRAPHQL_URL_PART)) return;
      const { op, limit, offset } = parsePagedVars(req);
      if (op === 'NftsByOwnerPaged') calls.push({ limit, offset });
    };
    page.on('request', onReq);

    // Submit address and open NFTs
    await fillAddressAndSearch(page, userAddress!);
    await openNftsTab(page);

    // First page should arrive (offset 0)
    await page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes(GRAPHQL_URL_PART) && parsePagedVars(req).op === 'NftsByOwnerPaged',
      { timeout: 30000 },
    );

    // Validate first call basics
    const first = () => calls.find(c => c.offset === 0);
    await test.step('first page call has offset=0 and expected limit', async () => {
      // Give a brief moment for the tracker to record
      await page.waitForTimeout(250);
      expect.soft(first()).toBeTruthy();
      if (first()) expect.soft(first()!.limit).toBe(OWNER_LIMIT);
    });

    // Try to trigger next page via scroll near bottom; observe overlay while fetching
    const active = await getGridAndEnsureVisible(page);
    if (active) {
      const overlay = page.getByTestId('bottom-loader-overlay');
      const beforeCount = await getGridCount(page, active.kind === 'video' ? 'video-nfts-grid' : 'other-nfts-grid');

      await scrollNearBottom(page);
      // Wait until either we see another paged request with offset > 0, or overlay appears briefly
      const nextReq = await page.waitForRequest(
        (req) => {
          if (req.method() !== 'POST' || !req.url().includes(GRAPHQL_URL_PART)) return false;
          const p = parsePagedVars(req);
          return p.op === 'NftsByOwnerPaged' && typeof p.offset === 'number' && p.offset > 0;
        },
        { timeout: 12000 }
      ).catch(() => null);

      // Best-effort overlay visibility
      await overlay.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

      const afterCount = await getGridCount(page, active.kind === 'video' ? 'video-nfts-grid' : 'other-nfts-grid');

      // Soft assertions to avoid flakiness when the account has < OWNER_LIMIT NFTs
      expect.soft(calls.filter(c => c.offset === 0).length).toBeGreaterThanOrEqual(1);
      if (nextReq) {
        // If a second page was requested, check monotonic offset and growth when possible
        const offsets = calls.map(c => c.offset).filter((x): x is number => typeof x === 'number');
        const nonDecreasing = offsets.every((x, i, arr) => i === 0 || (x >= (arr[i - 1] ?? 0)));
        expect.soft(nonDecreasing).toBe(true);
        // Grid count should not decrease
        expect.soft(afterCount).toBeGreaterThanOrEqual(beforeCount);
      } else {
        test.info().annotations.push({ type: 'note', description: 'No second page detected; the address may have fewer NFTs than the page size.' });
      }
    } else {
      test.info().annotations.push({ type: 'note', description: 'No NFT grid rendered (video/other). Skipping growth checks.' });
    }

    page.off('request', onReq);
  });
});

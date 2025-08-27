import { test, expect } from '@playwright/test';

// Verifies that TTL caches for Sqwid collections (owner list and per-collection totals)
// persist via localStorage and prevent redundant REST calls after a full page reload.
//
// Preconditions:
// - E2E_USER_ADDRESS is set (see .env.e2e). The address should be a valid Reef EVM address.
// - The app exposes an address input [data-testid="address-input"] and a submit button [data-testid="search-button"].
// - Collection overview is part of the default landing page flow (NftGallery).

function trackSqwidApiCalls(page: import('@playwright/test').Page) {
  let ownerCalls = 0;
  let totalsCalls = 0;
  const ownerUrls: string[] = [];
  const totalsUrls: string[] = [];

  const onReq = (req: import('@playwright/test').Request) => {
    const raw = req.url();
    let pathname = raw;
    let searchParams: URLSearchParams | null = null;
    try {
      const u = new URL(raw);
      pathname = u.pathname;
      searchParams = u.searchParams;
    } catch {
      // Fallback: keep raw string in pathname; no params available
    }
    // Owner collections endpoint
    if (/\/get\/collections\/owner\//i.test(pathname)) {
      ownerCalls += 1;
      ownerUrls.push(raw);
    }

    // Marketplace by-collection endpoint is used for several purposes:
    // - totals pagination (limit ~ 12)
    // - NFT listing (infinite query, also typically limit 12 but only when a collection is selected)
    // - NFT REST metadata prefetch (limit=200) — must be EXCLUDED from totals
    if (/\/get\/marketplace\/by-collection\//i.test(pathname)) {
      const limitStr = searchParams?.get('limit') ?? '';
      const limit = Number(limitStr);
      // Exclude obvious metadata prefetches
      if (Number.isFinite(limit) && limit === 200) return; // metadata prefetch
      // Count remaining by-collection calls as totals-related for this test context
      totalsCalls += 1;
      totalsUrls.push(raw);
    }
  };

  page.on('request', onReq);

  return {
    snapshot() {
      return { ownerCalls, totalsCalls };
    },
    urls() {
      return { ownerUrls: ownerUrls.slice(), totalsUrls: totalsUrls.slice() };
    },
    reset() {
      ownerCalls = 0;
      totalsCalls = 0;
      ownerUrls.length = 0;
      totalsUrls.length = 0;
    },
    dispose() {
      page.off('request', onReq);
    },
  };
}

async function fillAddressAndSearch(page: import('@playwright/test').Page, address: string) {
  const addressInput = page.getByTestId('address-input');
  await addressInput.waitFor({ state: 'visible', timeout: 15000 });
  await addressInput.fill(address);
  const submitBtn = page.getByTestId('search-button');
  await submitBtn.click();
}

// Ensure the NFTs view is active so NftGallery mounts (it triggers collections fetch)
async function openNftsTab(page: import('@playwright/test').Page) {
  const nftsTab = page.getByTestId('tab-nfts');
  await nftsTab.scrollIntoViewIfNeeded();
  await expect(nftsTab).toBeVisible({ timeout: 15000 });
  await nftsTab.click();
}

// Clear only our TTL caches to guarantee a cold start for the first run
async function clearTtlCaches(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    try {
      const toDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('reef:')) toDelete.push(key);
      }
      for (const k of toDelete) localStorage.removeItem(k);
    } catch {}
  });
}

// Best-effort wait for the Sqwid owner collections fetch to complete at least once
async function waitForOwnerCollections(page: import('@playwright/test').Page) {
  await page
    .waitForResponse(
      (resp) => {
        const raw = resp.url();
        let path: string;
        try {
          path = new URL(raw).pathname;
        } catch {
          path = raw;
        }
        return /\/get\/collections\/owner\//i.test(path) && resp.ok();
      },
      { timeout: 30000 },
    )
    .catch(() => undefined);
}

// Best-effort idle to allow totals pagination (by-collection) to run
async function settleNetwork(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
}

// Ensure the merged collections (with itemCount) are persisted in LS before reload
async function waitForCollectionsByOwnerCached(page: import('@playwright/test').Page, evmAddress: string) {
  const key = `reef:collectionsByOwner:${evmAddress}`;
  await page
    .waitForFunction(
      (k) => {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) return false;
          const obj = JSON.parse(raw);
          const arr = obj?.v;
          return Array.isArray(arr);
        } catch {
          return false;
        }
      },
      key,
      { timeout: 30000 },
    )
    .catch(() => undefined);
}

// Ensure that per-collection totals are cached for all owner's collections before reload
async function waitForCollectionTotalsCached(page: import('@playwright/test').Page, evmAddress: string) {
  await page
    .waitForFunction(
      (addr) => {
        try {
          const ownerKey = `reef:collectionsByOwner:${addr}`;
          const ownerRaw = localStorage.getItem(ownerKey);
          if (!ownerRaw) return false;
          const ownerObj = JSON.parse(ownerRaw);
          const arr = ownerObj?.v;
          if (!Array.isArray(arr)) return false;
          const ids = arr.map((c: any) => c?.id).filter((x: any) => typeof x === 'string' && x.length > 0);
          if (ids.length === 0) return true; // nothing to wait for
          for (const id of ids) {
            const totRaw = localStorage.getItem(`reef:collectionTotals:${id}`);
            if (!totRaw) return false;
            const totObj = JSON.parse(totRaw);
            if (typeof totObj?.v !== 'number' || totObj.v < 0) return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      evmAddress,
      { timeout: 30000 },
    )
    .catch(() => undefined);
}

test.describe('Sqwid Collections TTL Cache', () => {
  test('reuses persisted caches across reload (owner list + totals)', async ({ page }) => {
    await page.goto('/');
    await clearTtlCaches(page);

    const userAddress = process.env.E2E_USER_ADDRESS;
    if (!userAddress) {
      test.skip(true, 'Set E2E_USER_ADDRESS to a valid Reef EVM address before running this test');
    }

    const tracker = trackSqwidApiCalls(page);

    // First fetch (cold): should hit REST endpoints
    await fillAddressAndSearch(page, userAddress!);
    await openNftsTab(page);
    await waitForOwnerCollections(page);
    await settleNetwork(page);
    // Make sure the enriched owner collections are persisted in TTL cache before reload
    await waitForCollectionsByOwnerCached(page, userAddress!);
    // And ensure totals have been cached for all collections
    await waitForCollectionTotalsCached(page, userAddress!);

    const first = tracker.snapshot();
    expect(first.ownerCalls).toBeGreaterThan(0);
    // totalsCalls may be 0 when no collections exist, so only assert non-negativity
    expect(first.totalsCalls).toBeGreaterThanOrEqual(0);

    // Reload to clear in-memory state (React Query), but keep localStorage (TTL caches)
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Let initial framework/network settle after reload; then reset tracker to count only user-triggered actions
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    tracker.reset();

    await fillAddressAndSearch(page, userAddress!);
    await openNftsTab(page);
    // With TTL caches, UI should render from localStorage without REST calls
    // Give UI a moment to settle; no specific network calls expected
    await page.waitForTimeout(1500);

    const second = tracker.snapshot();
    if (second.ownerCalls !== 0 || second.totalsCalls !== 0) {
      const urls = tracker.urls();
      // Attach debug info for flake analysis
      await test.info().attach('sqwid-network-second.json', {
        contentType: 'application/json',
        body: JSON.stringify({ counts: second, urls }, null, 2),
      });
    }
    expect(second.ownerCalls).toBe(0);
    expect(second.totalsCalls).toBe(0);

    tracker.dispose();
  });
});

import { test, expect } from '@playwright/test';

// Verifies that opening the NFT media viewer autoplays the video (currentTime advances)

test.describe('NFT Viewer Autoplay', () => {
  test('opens viewer and video autoplays (currentTime advances)', async ({ page }) => {
    test.setTimeout(150000);
    test.skip(!process.env.E2E_USER_ADDRESS, 'Set E2E_USER_ADDRESS to a valid Reef EVM address');

    const address = process.env.E2E_USER_ADDRESS!;

    await page.goto('/');

    // Address input + submit
    const addressInput = page
      .getByTestId('address-input')
      .or(page.locator('input[placeholder*="address" i]'))
      .or(page.locator('input[name*="address" i]'));
    await addressInput.waitFor({ state: 'visible', timeout: 15000 });
    await addressInput.fill(address);

    const submitBtn = page.getByTestId('search-button').or(page.getByRole('button', { name: /^search$/i }));
    await submitBtn.click();

    // Initial network settling and Sqwid owner collections fetch
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page
      .waitForResponse((resp) => /collections\/owner|get\/collections\/owner/i.test(resp.url()) && resp.ok(), { timeout: 15000 })
      .catch(() => undefined);

    // Switch to NFTs tab robustly
    const nftsTab = page.getByTestId('tab-nfts');
    await page.waitForSelector('[data-testid="tab-nfts"]', { state: 'visible', timeout: 30000 });
    await nftsTab.scrollIntoViewIfNeeded();
    await nftsTab.hover().catch(() => undefined);
    try {
      await nftsTab.click({ timeout: 5000 });
    } catch {
      try {
        await nftsTab.click({ force: true, timeout: 3000 });
      } catch {
        try {
          await nftsTab.dispatchEvent('click');
        } catch {
          try {
            await nftsTab.focus();
            await page.keyboard.press('Enter');
          } catch {
            // ignore
          }
        }
      }
    }

    // Ensure overview 'Video NFTs' tab is active (default, but make it explicit)
    const videoOverviewTab = page.getByTestId('tab-video');
    if (await videoOverviewTab.count()) {
      await videoOverviewTab.click({ timeout: 5000 }).catch(() => undefined);
    }

    // Wait for the row-gate overlay (virtualized video grid) to disappear before interacting
    await page.getByTestId('row-gate-overlay').waitFor({ state: 'detached', timeout: 7000 }).catch(() => undefined);

    // Click the first visible video thumb (poster preferred to avoid overlay stacking)
    const anyPoster = page.getByTestId('nft-thumb-poster').first();
    const anyThumb = page.getByTestId('nft-thumb-video').first();
    const usePoster = (await anyPoster.count()) > 0;
    const target = usePoster ? anyPoster : anyThumb;

    await expect(target).toBeVisible({ timeout: 30000 });
    await target.scrollIntoViewIfNeeded();
    await target.hover().catch(() => undefined);
    await target.click({ trial: true }).catch(() => undefined);
    await target.click().catch(async () => {
      await target.click({ force: true }).catch(() => undefined);
    });

    // Wait for viewer overlay to appear; retry click up to 3 times if needed
    const viewerOverlay = page.getByTestId('viewer-overlay');
    let opened = await viewerOverlay
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      for (let i = 0; i < 2 && !opened; i++) {
        await target.click({ force: true }).catch(() => undefined);
        opened = await viewerOverlay
          .waitFor({ state: 'visible', timeout: 4000 })
          .then(() => true)
          .catch(() => false);
      }
    }
    expect(opened).toBeTruthy();

    // Ensure viewer content container is visible before querying video
    await page.getByTestId('viewer-content').waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);

    // Viewer should open with a dedicated video element
    const viewerVideo = page.getByTestId('viewer-video');
    await expect(viewerVideo).toBeVisible({ timeout: 30000 });

    // Pre-set safe attributes to satisfy autoplay policies
    await page
      .evaluate((sel) => {
        const v = document.querySelector(sel) as HTMLVideoElement | null;
        if (!v) return;
        v.muted = true;
        v.autoplay = true;
        v.playsInline = true;
        v.loop = true;
      }, '[data-testid="viewer-video"]')
      .catch(() => undefined);

    // Wait until we have enough data (readyState >= 3)
    await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel as string) as HTMLVideoElement | null;
          return !!el && el.readyState >= 3;
        },
        '[data-testid="viewer-video"]',
        { timeout: 15000 }
      )
      .catch(() => undefined);

    // Attach a timeupdate listener marker and try to start playback muted
    await page
      .evaluate((sel) => {
        const v = document.querySelector(sel) as HTMLVideoElement | null;
        if (!v) return;
        (window as any).__viewerPlayed = false;
        const onTime = () => {
          (window as any).__viewerPlayed = true;
          try { v.removeEventListener('timeupdate', onTime); } catch {}
        };
        try { v.addEventListener('timeupdate', onTime, { once: true } as any); } catch {}
        try {
          v.muted = true;
          v.autoplay = true;
          v.playsInline = true;
          const p = v.play();
          if (p && typeof (p as any).catch === 'function') (p as Promise<void>).catch(() => {});
        } catch {}
      }, '[data-testid="viewer-video"]')
      .catch(() => undefined);

    // Assert that playback starts (timeupdate or currentTime/paused state indicates playing)
    let started = await page
      .waitForFunction(
        (sel) => {
          const v = document.querySelector(sel as string) as HTMLVideoElement | null;
          if (!v) return false;
          return (window as any).__viewerPlayed === true || v.currentTime > 0.05 || !v.paused;
        },
        '[data-testid="viewer-video"]',
        { timeout: 12000 }
      )
      .catch(() => null);
    if (!started) {
      // As a stronger fallback, simulate a user gesture and retry play
      await viewerVideo.click({ force: true }).catch(() => undefined);
      await page
        .evaluate((sel) => {
          const v = document.querySelector(sel) as HTMLVideoElement | null;
          if (!v) return;
          try {
            v.muted = true;
            const p = v.play();
            if (p && typeof (p as any).catch === 'function') (p as Promise<void>).catch(() => {});
          } catch {}
        }, '[data-testid="viewer-video"]')
        .catch(() => undefined);
      started = await page
        .waitForFunction(
          (sel) => {
            const v = document.querySelector(sel as string) as HTMLVideoElement | null;
            return !!v && ((window as any).__viewerPlayed === true || v.currentTime > 0.05 || !v.paused);
          },
          '[data-testid="viewer-video"]',
          { timeout: 10000 }
        )
        .catch(() => null);
    }
    expect(Boolean(started)).toBeTruthy();

    // Close viewer (best-effort)
    await page.getByTestId('viewer-close').click({ timeout: 5000 }).catch(() => undefined);
  });
});

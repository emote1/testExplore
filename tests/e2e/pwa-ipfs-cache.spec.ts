import { test, expect, request } from '@playwright/test';

// Этот тест проверяет, что PWA сервис-воркер кэширует IPFS-ресурсы
// Требуется запущенный Vite preview на http://localhost:4173
// Шаги запуска:
// 1) npm run build
// 2) npm run preview -- --port 4173
// 3) npx playwright test tests/e2e/pwa-ipfs-cache.spec.ts --project=chromium --headed

const PREVIEW_URL = 'http://localhost:4173';
// Берём адрес из env (E2E_USER_ADDRESS) или используем видео-насыщенный адрес по умолчанию
const TEST_EVM_ADDRESS: string = (process.env.E2E_USER_ADDRESS || '0x55fc4A9D984C725bE1D099152FE270690aEFb977') as string;
const IPFS_MEDIA_SELECTOR = 'img[src*="/ipfs/"], source[src*="/ipfs/"], video[poster*="/ipfs/"], video[src*="/ipfs/"]';

function extractCidPath(url: string): string | null {
  try {
    const m = url.match(/\/ipfs\/([^?#]+)/i);
    return m && m[1] ? m[1] : null;
  } catch {
    return null;
  }
}

test.describe('PWA IPFS runtime caching', () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let reachable = false;
    try {
      const res = await ctx.get(PREVIEW_URL, { timeout: 2000 });
      reachable = res.ok();
    } catch {
      reachable = false;
    }
    await ctx.dispose();
    test.skip(!reachable, 'Vite preview is not running on :4173. Run: npm run preview -- --port 4173');
  });

  test('should cache an IPFS asset via Service Worker', async ({ page }) => {
    // Открываем превью-сайт (build) — только здесь SW регистрируется по умолчанию
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });

    // Дожидаемся готовности сервис-воркера
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false as const;
      await navigator.serviceWorker.ready;
      return true as const;
    });

    // Перезагрузим страницу, чтобы гарантировать захват клиентов (если требуется)
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Убедимся, что страница находится под контролем SW (controller установлен)
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 15000 });

    // Вводим адрес и переходим в раздел NFTs, чтобы загрузились IPFS-медиа
    await expect(page.getByTestId('address-input')).toBeVisible();
    await page.getByTestId('address-input').fill(TEST_EVM_ADDRESS);
    await page.getByTestId('search-button').click();
    // Робастный клик по табу NFTs с несколькими запасными вариантами
    const nftsTab = page.getByTestId('tab-nfts');
    await page.waitForSelector('[data-testid="tab-nfts"]', { state: 'visible', timeout: 30000 });
    await nftsTab.scrollIntoViewIfNeeded();
    await nftsTab.hover().catch(() => undefined);
    await expect(nftsTab).toBeEnabled();
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
            // no-op
          }
        }
      }
    }
    await expect(nftsTab).toHaveClass(/border-blue-600/);
    // Дождаться заголовка секции NFTs и исчезновения оверлея
    await page.waitForSelector('[data-testid="nft-header"]', { timeout: 30000 });
    await page.getByTestId('row-gate-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    // Явно выбрать таб "Video NFTs", если он существует (по умолчанию он и так активен)
    const tabVideo = page.getByTestId('tab-video');
    if (await tabVideo.count()) {
      await tabVideo.click();
      await page.getByTestId('row-gate-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    }
    // Дождаться появления карточек; затем пролистывать, чтобы раскрыть lazy-loaded IPFS-медиа
    await page.waitForSelector('[data-testid="nft-card"]', { timeout: 30000 });
    for (let i = 0; i < 8; i++) {
      const exists = await page.evaluate((sel) => !!document.querySelector(sel), IPFS_MEDIA_SELECTOR);
      if (exists) break;
      await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.9)));
      await page.waitForTimeout(750);
    }

    // Найдём первый IPFS-URL на странице (img/video/source src или poster)
    const ipfsUrl = await page.evaluate(() => {
      const isIpfs = (u?: string | null) => !!u && /https?:\/\/[^/]+\/ipfs\/.+/i.test(u);
      const candidates: (HTMLImageElement | HTMLVideoElement | HTMLSourceElement)[] = Array.from(
        document.querySelectorAll('img, video, source')
      );
      for (const el of candidates) {
        const poster = (el as HTMLVideoElement).poster || null;
        const src = (el as HTMLImageElement).src || (el as HTMLVideoElement).src || (el as HTMLSourceElement).src || null;
        if (isIpfs(poster)) return poster;
        if (isIpfs(src)) return src;
      }
      // Попробуем посмотреть на карточки NFT
      const cards = Array.from(document.querySelectorAll('[data-testid="nft-card"]')) as HTMLElement[];
      for (const card of cards) {
        const img = card.querySelector('img') as HTMLImageElement | null;
        const video = card.querySelector('video') as HTMLVideoElement | null;
        if (img && isIpfs(img.src)) return img.src;
        if (video && isIpfs(video.poster)) return video.poster;
        if (video && isIpfs(video.currentSrc)) return video.currentSrc;
      }
      return null;
    });

    expect(ipfsUrl, 'No IPFS asset found on the page to test caching').toBeTruthy();

    // Вызовем дополнительный fetch, чтобы гарантировать попадание в runtimeCaching (может быть opaque ответ)
    const cidPath = extractCidPath(ipfsUrl!);
    expect(cidPath, 'ipfs cid/path should be detectable').toBeTruthy();

    // Сформируем список кандидатов на основе известных шлюзов; это повышает шанс совпадения с правилом SW
    const gatewayCandidates = [
      ipfsUrl!,
      `https://reef.infura-ipfs.io/ipfs/${cidPath}`,
      `https://ipfs.io/ipfs/${cidPath}`,
      `https://cloudflare-ipfs.com/ipfs/${cidPath}`,
      `https://dweb.link/ipfs/${cidPath}`,
    ];

    // Trigger fetches so the SW can handle and cache them (opaque allowed).
    // Avoid a single long evaluate in Firefox: fetch each URL with a short abort timeout.
    for (const u of gatewayCandidates) {
      await page
        .evaluate(async (url: string) => {
          try {
            const ac = new AbortController();
            const tid = window.setTimeout(() => {
              try { ac.abort(); } catch {}
            }, 2500);
            try {
              await fetch(url, { mode: 'no-cors', signal: ac.signal as AbortSignal });
            } catch {}
            try { window.clearTimeout(tid); } catch {}
          } catch {}
        }, u)
        .catch(() => undefined);
      await page.waitForTimeout(200);
    }

    // Ensure at least one IPFS response for this CID happened before probing CacheStorage
    await page
      .waitForResponse(
        (resp) => /\/ipfs\//i.test(resp.url()) && resp.url().includes(cidPath!),
        { timeout: 15000 }
      )
      .catch(() => undefined);

    // Probe CacheStorage in short iterations (avoid long single evaluate which can time out in Firefox)
    async function probeOnce(): Promise<boolean> {
      return await page.evaluate(async (args: { urls: string[]; cid: string }) => {
        try {
          // 1) Direct URL match and Request(no-cors) match
          for (const u of args.urls) {
            try {
              const m1 = await caches.match(u);
              if (m1) return true;
            } catch {}
            try {
              const m1b = await caches.match(new Request(u, { mode: 'no-cors' as RequestMode }));
              if (m1b) return true;
            } catch {}
          }
          // 2) Ignore search
          for (const u of args.urls) {
            try {
              const m2 = await caches.match(u, { ignoreSearch: true as any });
              if (m2) return true;
            } catch {}
          }
          // 3) Explicit 'ipfs' cache
          try {
            const ipfsCache = await caches.open('ipfs');
            const keys = await ipfsCache.keys();
            if (keys.some((k) => k.url.includes(args.cid))) return true;
          } catch {}
          // 4) Scan all caches
          try {
            const names = await caches.keys();
            for (const name of names) {
              try {
                const cache = await caches.open(name);
                const keys = await cache.keys();
                if (keys.some((k) => k.url.includes(args.cid))) return true;
              } catch {}
            }
          } catch {}
          return false;
        } catch {
          return false;
        }
      }, { urls: gatewayCandidates, cid: cidPath! });
    }

    let matched = false;
    for (let i = 0; i < 40 && !matched; i++) {
      matched = await probeOnce();
      if (matched) break;
      await page.waitForTimeout(1000);
    }

    expect(matched, `Expected to find ${cidPath} in CacheStorage (searched all cache entries)`).toBe(true);
  });
});

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
    const res = await ctx.get(PREVIEW_URL);
    await ctx.dispose();
    test.skip(!res.ok(), 'Vite preview is not running on :4173. Run: npm run preview -- --port 4173');
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
    await page.getByTestId('tab-nfts').click();
    // Overlay from row gating may temporarily block interactions; wait until it's gone
    await page.getByTestId('row-gate-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    // Дождаться заголовка секции NFTs
    await page.waitForSelector('[data-testid="nft-header"]', { timeout: 30000 });
    // Явно выбрать таб "Video NFTs", если он существует (по умолчанию он и так активен)
    const tabVideo = page.getByTestId('tab-video');
    if (await tabVideo.count()) {
      await tabVideo.click();
      await page.getByTestId('row-gate-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    }
    // Дождаться появления карточек и хотя бы одного IPFS-медиа
    await page.waitForSelector('[data-testid="nft-card"]', { timeout: 30000 });
    await page.waitForSelector(IPFS_MEDIA_SELECTOR, { timeout: 30000 });

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

    // Сделаем запрос и проверим, что он попал в CacheStorage в одном из кэшей (имя может отличаться в Workbox)
    const matched = await page.evaluate(async (args: { targetUrl: string; cid: string }) => {
      try {
        // Явно инициируем сеть (opaque/206 допустимы)
        await fetch(args.targetUrl, { mode: 'no-cors', cache: 'reload' });
        for (let i = 0; i < 20; i++) { // ~20 секунд с шагом 1с
          const names = await caches.keys();
          for (const name of names) {
            try {
              const cache = await caches.open(name);
              const keys = await cache.keys();
              if (keys.some((k) => k.url.includes(args.cid))) return true;
            } catch {
              // Игнорируем ошибки отдельных кэшей
            }
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        return false;
      } catch (e) {
        return false;
      }
    }, { targetUrl: ipfsUrl!, cid: cidPath! });

    expect(matched, `Expected to find ${cidPath} in CacheStorage (searched all cache entries)`).toBe(true);
  });
});

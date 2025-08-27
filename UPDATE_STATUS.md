# Update Status — 2025-08-25 23:55:00 +03:00

Commit: N/A

## Summary
- Added cross-origin video preload and tightened PWA caching for IPFS range requests.

## Changes
- `src/components/NftGallery.tsx` (PreloadTopVideos): add crossOrigin="anonymous" on cross-origin preload links and `referrerpolicy="no-referrer"`.
- `vite.config.ts` (Workbox): change `cacheableResponse.statuses` to `[0, 200]` to avoid caching 206 partial content.

## Rationale
- Reduce ERR_CACHE_OPERATION_NOT_SUPPORTED from video range requests.
- Align with `<video crossOrigin="anonymous">` for cache reuse.
- Avoid leaking referrer to gateway hosts.

## Test Results (Chromium, Firefox, WebKit — preview config)
- tests/e2e/pwa-ipfs-cache.spec.ts — PASSED (~1.0–1.2m) at 2025-08-26 00:16 +03:00

# Update Status — 2025-08-25 23:34:21 +03:00

Commit: N/A

## Summary
- Removed infinite scroll and dedupe E2E test by request; coverage removed.
- Updated TODO to mark this item as removed.

## Changes
- Deleted `tests/e2e/infinite-scroll-dedup.spec.ts`
- Updated `TODO.md` QA item: Infinite scroll dedupe — removed

## Test Results
- Not run in this update.

# Update Status — 2025-08-24 19:14:15 +03:00

Commit: cad5e64

## Summary
- Stabilized targeted Playwright E2E tests under Vite preview + PWA SW.
- Hardened infinite scroll test against virtualization; fixed PWA IPFS runtime caching detection.

## Changes
  - Added helpers to detect newly loaded items by NFT ID and actively scroll to reveal them.
  - Ensures ID-level dedup across pages.
- tests/e2e/pwa-ipfs-cache.spec.ts
  - Extended retry window; probe multiple IPFS gateway candidates and both caches.match and direct cache scans.
  - Validates SW caches an IPFS asset.
- vite.config.ts (VitePWA Workbox runtimeCaching)
  - Broadened IPFS URL match to support http/https, path-based and subdomain gateways, allowing uppercase subdomain CIDs.
  - Strategy: StaleWhileRevalidate; cacheName: "ipfs"; statuses: [0, 200, 206]; expiration: 400 entries / 7 days.

```ts
urlPattern: /^https?:\/\/(?:[^\/]+\/ipfs\/.*|[A-Za-z0-9]+\.ipfs\.[^\/]+\/.*)$/,
handler: 'StaleWhileRevalidate',
options: {
  cacheName: 'ipfs',
  expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
  cacheableResponse: { statuses: [0, 200, 206] },
}
```

## Test Results (Chromium, preview config)
- tests/e2e/infinite-scroll-dedup.spec.ts — PASSED (~1.1–1.2m)
- tests/e2e/pwa-ipfs-cache.spec.ts — PASSED (~17–18s)

## Environment
- Preview server: vite preview (localhost:4173) via playwright.preview.config.ts
- Service Worker: vite-plugin-pwa (autoUpdate, auto inject)

## Next Steps
- Optional: run full Playwright suite across all browsers to confirm stability.
- Optional: add CI flake detection by repeat-running targeted tests (repeat-each=3).

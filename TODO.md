# TODO: Performance and Architecture Plan

This document tracks the optimizations we plan to implement, the test coverage to add, and success criteria. Check off items as they are completed. After completion, record results in UPDATE_STATUS.md.

## 1) Performance & UX
- [x] Shared IntersectionObserver hook for all previews (replace per-card observers in `src/components/NftGallery.tsx` VideoThumb)
- [x] AbortController for all custom `fetch()` in `src/hooks/use-sqwid-nfts.ts` (metadata, tokenURI, Sqwid REST, RPC calls where applicable) to cancel on unmount/address change
- [x] Dynamic `<link rel="preload" as="video">` for top 2–4 videos (insert/remove in `<head>` on mount/unmount of grid)
- [x] Virtualized grid for large lists using `@tanstack/react-virtual` (collections and "Other NFTs") — implemented via `VirtualizedGrid` in `src/components/NftGallery.tsx`
- [x] PWA Service Worker via `vite-plugin-pwa` with runtime caching for IPFS gateways (incl. `reef.infura-ipfs.io`); `stale-while-revalidate`

## 2) Hooks & Data Fetching
- [x] Migrate `use-sqwid-nfts` to TanStack Query (now using `useQuery` with `AbortSignal` integration)
- [ ] Evaluate `useInfiniteQuery` for paging and `useQueries` for per-NFT metadata
- [ ] Unify and encapsulate caches in `use-sqwid-nfts.ts` (tokenUriCache, blockCache, sqwidCache) with TTL and centralized invalidation

## 3) Architecture & Code Structure
- [x] Extract IPFS helpers to `src/utils/ipfs.ts` and reuse across:
  - `toCidPath()`
  - `buildCandidates()`
  - `toIpfsHttp()` (unify variants)
- [x] Create `src/components/media/` and split components:
  - `nft-video-thumb.tsx` (grid preview)
  - `nft-media-viewer.tsx` (detail viewer)
- [x] Introduce preview playback coordinator (context/event bus) to limit concurrent playing thumbnails (e.g., max 1–2 at a time)

## 4) Network & Content
- [ ] Content-side: ensure mp4 files are prepared with `-movflags +faststart` for fast first frame
- [x] Multiple IPFS gateways via `.env` with sequential failover (metadata fetch uses `fetchIpfsWithFallback()`, media components use `buildCandidates()`)
- [x] Document IPFS gateway env configuration in `.env.example` (`VITE_IPFS_GATEWAYS`, `VITE_IPFS_GATEWAY`)

## 5) QA & Tests (Playwright + unit)
- [x] Unit tests for `src/utils/ipfs.ts` (URL normalization, candidate generation)
- [ ] E2E: Viewer video autoplays (with muted fallback) — assert video currentTime advances after open
- [ ] E2E: Priority thumbnails preload earlier — removed (test deleted)
- [x] E2E: Regression — quantity badges render for `amount > 1` (ERC-1155)
- [ ] E2E: Infinite scroll still loads more pages and dedupes IDs correctly — removed (test deleted)
- [x] E2E: PWA IPFS runtime caching — caches IPFS asset via Service Worker — PASSED (preview: Chromium/Firefox/WebKit) 2025-08-26 00:16
- [ ] E2E: No excessive concurrent network calls (smoke — limit simultaneous metadata fetches)

## 6) Success Criteria
- [ ] All tasks above checked or explicitly deferred
- [ ] `npm run build` passes; no type errors
- [ ] Playwright tests pass locally and in CI
- [ ] Perceived load time improved: first visible video preview shows frame within ~1s on typical connection
- [ ] Create/update `UPDATE_STATUS.md` with:
  - Summary of implemented items
  - Test run results (pass/fail)
  - Timestamp and commit hash

## 7) Lint & Typing
- [x] Remove explicit `any` and empty catch blocks in `src/hooks/use-sqwid-nfts.ts`
- [x] Replace unsafe GraphQL result access with safe getters in `use-sqwid-nfts.ts`
- [ ] Define interfaces for GraphQL query results and adopt in `use-sqwid-nfts.ts`

## Implementation Order (suggested)
1. AbortController in `use-sqwid-nfts.ts`
2. Shared `useInView` + limit concurrent preview playback
3. Dynamic `<link rel=preload>` for top-N videos
4. Virtualize grids
5. Extract IPFS utils and split media components
6. Migrate `use-sqwid-nfts` to TanStack Query


## Commands
- Build: `npm run build`
- Lint: `npm run lint`
- E2E: `npm run test:e2e`

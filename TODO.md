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

## 8) Transactions: Real-time, Pagination & UX

### Completed
- [x] Support EVM addresses in polling and pagination (OR by native id and EVM address) — hooks: `src/hooks/useTransferSubscription.ts`, `src/hooks/use-transaction-data-with-blocks.ts`
- [x] Responsive table layout (timestamp visible, fee compact, narrow actions)

### Quick Wins (prioritized)
- [x] Unified address filter builder `buildTransferWhereFilter()` in `src/utils/transfer-query.ts`; reuse in both hooks
- [x] Add secondary sort key `id_DESC` to `orderBy` for stability on equal timestamps
- [x] New-row highlight with auto-fade (non-intrusive UX cue)

### Reliability & Correctness
- [x] Pause polling when tab hidden (`visibilitychange`), resume on visible
- [x] Cap the set of seen transfer IDs to last N=200 per address; reset on address change
- [x] Centralize timestamp formatting and show full value in tooltip/title
- [x] Enforce stable client-side sorting (`timestamp_DESC,id_DESC`) after mapping to ensure deterministic order
- [x] UI-level deduplication by `id` after sorting to guard against cache merge races

### Performance & UX
- [x] Virtualize table rows with `@tanstack/react-virtual` (large lists)
- [x] Apollo field policy for `transfersConnection` (`keyArgs: ['where','orderBy']`, merge unique by `node.id`) + prepend new items via cache update (no full refetch)
- [x] LRU cache (with TTL) in `use-address-resolver.ts` to avoid repeated address resolution calls
- [x] Handle virtual shift on subscription prepend on page 1: auto-reanchor to current first id; deep pages remain stable (no auto-reanchor)
- [ ] Show “New X items” banner on page 1 (deferred)
### Architecture & Code Structure
- [x] Extract `transfer-new-items` detector util to avoid duplication between hooks
- [x] Consolidate GraphQL `Transfer` fragments in `src/data/transfers.ts` and reuse in queries
- [x] Harmonize fetch policies (initial: `cache-and-network`; polling: `network-only`)

### QA & Tests
- [ ] E2E: EVM polling — enter 0x address, tick, new row appears on page 1
- [x] Unit: `buildTransferWhereFilter()` cases (native-only, evm-only, both)

### Pagination & Caching Plan (MVP)
 - [x] Adapter: ensureLoaded — sequential `fetchMore()` until `(pageIndex+1)*UI_SIZE` loaded; cap by `PAGINATION_CONFIG.MAX_SEQUENTIAL_FETCH_PAGES`; guard concurrent calls.
 - [x] Idle prefetch: when tab visible and idle, prefetch next API page (use `requestIdleCallback` with `setTimeout` fallback).
 - [x] Pause on hidden tab: skip idle prefetch if `document.hidden`.
  - [ ] Page count: estimate from loaded items + `hasNextPage`; freeze when end reached.
  - [x] Handle virtual shift on subscription prepend on page 1: auto-reanchor to current first id; deep pages remain stable (no auto-reanchor).
  - [ ] Show “New X items” banner on page 1 (deferred).

 ### Pagination Stability & Parity (follow‑ups)
 - [x] Apollo typePolicy merge for `transfersConnection` (first page): prepend + dedupe into existing edges instead of full replace, to preserve already appended pages and maintain total ordering during network refresh (`fetchPolicy: cache-and-network`). Keep/merge `pageInfo.endCursor` sensibly (prefer existing when longer list is present). Implemented in `src/apollo-client.ts`.
 - [ ] Anchor stability on deep pages: do not re‑anchor when `anchorFirstId` disappears (e.g., first page refresh trims it). Keep anchor until user explicitly reveals new items or returns to page 1. This prevents offset jumps between consecutive pages.
 - [ ] Expose `hasExactTotal` from adapter and update UI: hide “last” quick chip when total is unknown; render “Page X of ~Y”.
 - [ ] Extract `useIdlePrefetchNextPage(fetchMore)` small hook; unit‑test scheduling/visibility guards.
 - [ ] Update URL (`?page=<index>`) via `history.replaceState` on page changes for shareable deep links.

### QA & Tests — ordering and Reefscan parity
 - [ ] Unit: synthetic list to validate merged connection remains strictly non‑increasing by `timestamp_DESC,id_DESC` across all edges after first‑page refresh + appends.
 - [ ] E2E: deep navigation N→N+1 keeps non‑increasing timestamps (assert last row of page N >= first row of page N+1).
 - [ ] E2E: deep jump (e.g., page 12→13) does not show newer dates on the next page.
 - [ ] E2E: no duplicate transfer IDs across pagination boundaries and after subscription updates (first-page prepend).
 - [ ] Parity check vs Reefscan for the reported address: verify filters (native id OR EVM) and ordering match; record any missing extrinsics or differing semantics (e.g., fee-only events, internal transfers). Document findings in `UPDATE_STATUS.md`.

### Backend/API (if available)
- [ ] Expose fee directly in transfer query to remove extra extrinsic-fee batch fetch

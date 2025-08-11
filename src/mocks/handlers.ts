import { http, HttpResponse } from 'msw';

// Simple in-memory fixtures for tests
const FIXTURE_COLLECTION_ID = 'COLL_TEST_1';

function buildCollectionResponse(limit: number, startFrom: number) {
  const total = 30;
  const items = Array.from({ length: Math.min(limit, Math.max(0, total - startFrom)) }).map((_, i) => {
    const idx = startFrom + i + 1;
    return {
      id: `nft-${idx}`,
      name: `NFT ${idx}`,
      image: `https://example.com/nft-${idx}.png`,
    };
  });
  return { items, total };
}

export const handlers = [
  // GET /get/marketplace/by-collection/<COLLECTION_ID>/<any>?limit=..&startFrom=..
  http.get('https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/:collectionId/:seg', ({ params, request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '12');
    const startFrom = Number(url.searchParams.get('startFrom') ?? '0');
    const { collectionId } = params as { collectionId: string };

    // Basic routing: success for known test ID, 404 otherwise
    if (collectionId !== FIXTURE_COLLECTION_ID) {
      return HttpResponse.json({ items: [], total: 0 }, { status: 200 });
    }

    const payload = buildCollectionResponse(limit, startFrom);
    return HttpResponse.json(payload, { status: 200 });
  }),
  // Fallback for the same host to prevent unhandled requests in tests
  http.get('https://sqwid-api-mainnet.reefscan.info/*', () => {
    return HttpResponse.json({ items: [], total: 0 }, { status: 200 });
  }),
];

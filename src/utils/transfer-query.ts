// Backend-mode flag shared by the data layer: the app talks either to the
// self-hosted Hasura (via the /api/reef-explorer proxy) or to the public
// Subsquid, and query documents differ between the two.
//
// The transfer where/orderBy builders that used to live here served the
// classic explorer's table and died with it.

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EXPLORER_HTTP_URL = ENV.VITE_REEF_EXPLORER_HTTP_URL ?? '';
const EXPLORER_BACKEND = (ENV.VITE_REEF_EXPLORER_BACKEND ?? '').toLowerCase();

const isLikelyHasuraEndpoint = EXPLORER_HTTP_URL.includes('/v1/graphql')
  || EXPLORER_HTTP_URL.includes('/api/reef-explorer');

export const isHasuraExplorerMode = EXPLORER_BACKEND
  ? EXPLORER_BACKEND === 'hasura'
  : isLikelyHasuraEndpoint;

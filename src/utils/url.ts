/**
 * URL heuristics helpers
 */
export function isLikelyRpcEndpoint(uri: string): boolean {
  try {
    const u = new URL(uri);
    return /rpc\.reefscan\.com/i.test(u.hostname) || /\/rpc(\/|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

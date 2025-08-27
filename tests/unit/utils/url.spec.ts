import { describe, it, expect } from 'vitest';
import { isLikelyRpcEndpoint } from '../../../src/utils/url';

describe('utils/url', () => {
  it('detects reefscan rpc host', () => {
    expect(isLikelyRpcEndpoint('https://rpc.reefscan.com')).toBe(true);
    expect(isLikelyRpcEndpoint('https://rpc.reefscan.com/ws')).toBe(true);
  });

  it('detects /rpc path segments', () => {
    expect(isLikelyRpcEndpoint('https://example.com/rpc')).toBe(true);
    expect(isLikelyRpcEndpoint('https://api.example.com/rpc/v1')).toBe(true);
  });

  it('returns false for non-rpc urls or invalid urls', () => {
    expect(isLikelyRpcEndpoint('https://example.com/api')).toBe(false);
    expect(isLikelyRpcEndpoint('not-a-url')).toBe(false);
  });
});

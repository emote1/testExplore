import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toCidPath,
  buildCandidates,
  normalizeIpfs,
  isIpfsLike,
  toIpfsHttp,
  fetchIpfsWithFallback,
  DEFAULT_IPFS_GATEWAYS,
} from '../../src/utils/ipfs';

describe('ipfs utils: toCidPath()', () => {
  it('parses ipfs://<cid>/<path>', () => {
    expect(toCidPath('ipfs://bafyabc/dir/file.png')).toBe('bafyabc/dir/file.png');
  });
  it('parses ipfs://ipfs/<cid>/<path>', () => {
    expect(toCidPath('ipfs://ipfs/bafyabc/dir')).toBe('bafyabc/dir');
  });
  it('parses http gateway path /ipfs/<cid>/<path>', () => {
    expect(toCidPath('https://ipfs.io/ipfs/bafyabc/dir')).toBe('bafyabc/dir');
  });
  it('parses subdomain gateway <cid>.ipfs.<host>/<path>', () => {
    expect(toCidPath('https://bafyabc.ipfs.dweb.link/dir/x.png')).toBe('bafyabc/dir/x.png');
  });
  it('returns null for non-ipfs url', () => {
    expect(toCidPath('https://example.com/notipfs')).toBeNull();
  });
});

describe('ipfs utils: normalizeIpfs()', () => {
  it('normalizes any IPFS-like URL to provided gateway', () => {
    const base = 'https://gw.example/ipfs/';
    expect(normalizeIpfs('ipfs://bafyabc/dir', base)).toBe('https://gw.example/ipfs/bafyabc/dir');
    expect(normalizeIpfs('https://ipfs.io/ipfs/bafyabc/dir', base)).toBe('https://gw.example/ipfs/bafyabc/dir');
    expect(normalizeIpfs('https://bafyabc.ipfs.dweb.link/dir', base)).toBe('https://gw.example/ipfs/bafyabc/dir');
  });
});

describe('ipfs utils: toIpfsHttp()', () => {
  it('converts only ipfs:// to default gateway http', () => {
    const url = 'ipfs://bafyabc/dir';
    const out = toIpfsHttp(url);
    expect(out).toBe(`${DEFAULT_IPFS_GATEWAYS[0]}bafyabc/dir`);
  });
  it('does not rewrite existing http(s) ipfs gateway urls', () => {
    const url = 'https://ipfs.io/ipfs/bafyabc/dir';
    expect(toIpfsHttp(url)).toBe(url);
  });
});

describe('ipfs utils: buildCandidates()', () => {
  it('builds candidates from custom gateways', () => {
    const gates = ['https://a.example/ipfs/', 'https://b.example/ipfs/'];
    const out = buildCandidates('ipfs://bafyabc/file.png', gates);
    expect(out).toEqual([
      'https://a.example/ipfs/bafyabc/file.png',
      'https://b.example/ipfs/bafyabc/file.png',
    ]);
  });
  it('returns original url when not ipfs-like', () => {
    const out = buildCandidates('https://example.com/img.png', ['https://a/ipfs/']);
    expect(out).toEqual(['https://example.com/img.png']);
  });
  it('returns empty array for falsy url', () => {
    expect(buildCandidates(undefined as unknown as string)).toEqual([]);
  });
});

describe('ipfs utils: isIpfsLike()', () => {
  it('detects multiple ipfs shapes', () => {
    expect(isIpfsLike('ipfs://bafyabc/x')).toBe(true);
    expect(isIpfsLike('https://ipfs.io/ipfs/bafyabc/x')).toBe(true);
    expect(isIpfsLike('https://bafyabc.ipfs.dweb.link/x')).toBe(true);
    expect(isIpfsLike('https://example.com/x')).toBe(false);
  });
});

describe('ipfs utils: fetchIpfsWithFallback()', () => {
  const gates = ['https://a.example/ipfs/', 'https://b.example/ipfs/'];
  const url = 'ipfs://bafyabc/data.json';
  const candidates = [
    'https://a.example/ipfs/bafyabc/data.json',
    'https://b.example/ipfs/bafyabc/data.json',
  ];

  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (realFetch) {
      // restore if we overwrote
      // @ts-ignore
      globalThis.fetch = realFetch;
    }
  });

  it('returns first ok response and stops trying', async () => {
    const fetchMock = vi.fn()
      // first -> not ok
      .mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response)
      // second -> ok
      .mockResolvedValueOnce({ ok: true, status: 200 } as unknown as Response);
    // @ts-ignore
    globalThis.fetch = fetchMock;

    const resp = await fetchIpfsWithFallback(url, undefined, gates);
    expect(resp).not.toBeNull();
    expect(resp!.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, candidates[0], undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(2, candidates[1], undefined);
  });

  it('returns last failed response when all candidates fail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 504 } as unknown as Response);
    // @ts-ignore
    globalThis.fetch = fetchMock;

    const resp = await fetchIpfsWithFallback(url, undefined, gates);
    expect(resp).not.toBeNull();
    expect(resp!.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { Loader2, Wallet, Copy, Check } from 'lucide-react';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { formatTokenAmount } from '@/utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import React from 'react';
import { shortenHash } from '@/utils/formatters';
import { useTokenIcons } from '@/hooks/use-token-icons';
import { isIpfsLike, buildCandidates } from '@/utils/ipfs';
import { useTokenUsdPrices } from '@/hooks/use-token-usd-prices';

interface BalancesTableProps {
  address: string;
}

export function BalancesTable({ address }: BalancesTableProps) {
  const { balances, loading, error, totalCount } = useTokenBalances(address, 50);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [hideNoPrice, setHideNoPrice] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: 'balance' | 'value'; dir: 'asc' | 'desc' } | null>(null);

  // Well-known token logo fallbacks (external). Try in order.
  const TOKEN_LOGO_FALLBACKS: Record<string, string[]> = React.useMemo(() => ({
    REEF: [
      '/token-logos/reef.png',
    ],
  }), []);

  // Per-contract overrides (exact match by contract id, LOWERCASE keys)
  // Use local assets in public/token-logos to avoid CORS/CORP issues
  const TOKEN_LOGO_OVERRIDES: Record<string, string[]> = React.useMemo(() => ({
    // REEF system token — only reef.png per request
    '0x0000000000000000000000000000000001000000': [
      '/token-logos/reef.png',
    ],
  }), []);

  // Query official icons only for the tokens that are currently shown
  const tokenIds = React.useMemo(() => balances.map((b) => b.token.id), [balances]);
  const { icons: iconsById } = useTokenIcons(tokenIds, 100);

  // Prepare pricing inputs and fetch USD prices via Reefswap reserves
  const pricingInputs = React.useMemo(() => balances.map((b) => ({ id: b.token.id, decimals: b.token.decimals })), [balances]);
  const { pricesById } = useTokenUsdPrices(pricingInputs);

  const displayBalances = React.useMemo(() => {
    const filtered = hideNoPrice
      ? balances.filter((b) => {
          const price = pricesById[(b.token.id || '').toLowerCase()] ?? null;
          return typeof price === 'number' && Number.isFinite(price) && price > 0;
        })
      : balances.slice();
    if (!sort) return filtered;
    const arr = filtered.slice();
    arr.sort((a, b) => {
      if (sort.key === 'balance') {
        const aAmt = toFloatAmount(a.balance, a.token.decimals);
        const bAmt = toFloatAmount(b.balance, b.token.decimals);
        const cmp = aAmt - bAmt;
        return sort.dir === 'asc' ? (cmp < 0 ? -1 : cmp > 0 ? 1 : 0) : (cmp < 0 ? 1 : cmp > 0 ? -1 : 0);
      }
      const ap = pricesById[(a.token.id || '').toLowerCase()] ?? null;
      const bp = pricesById[(b.token.id || '').toLowerCase()] ?? null;
      const aVal = (typeof ap === 'number' && Number.isFinite(ap) && ap > 0 ? ap : 0) * toFloatAmount(a.balance, a.token.decimals);
      const bVal = (typeof bp === 'number' && Number.isFinite(bp) && bp > 0 ? bp : 0) * toFloatAmount(b.balance, b.token.decimals);
      const cmp = aVal - bVal;
      return sort.dir === 'asc' ? (cmp < 0 ? -1 : cmp > 0 ? 1 : 0) : (cmp < 0 ? 1 : cmp > 0 ? -1 : 0);
    });
    return arr;
  }, [balances, hideNoPrice, pricesById, sort]);

  // Helpers
  function toFloatAmount(amountStr: string, decimals: number): number {
    const s = (amountStr || '').trim();
    if (!/^\d+$/.test(s)) return 0;
    if (decimals === 0) return Number(s);
    if (s.length <= decimals) {
      const pad = s.padStart(decimals, '0');
      return Number(`0.${pad}`);
    }
    const head = s.slice(0, s.length - decimals);
    const tail = s.slice(s.length - decimals);
    return Number(`${head}.${tail}`);
  }
  const usdFmt = React.useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }), []);
  
  function toggleSort(key: 'balance' | 'value') {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
    });
  }

  function sortIndicator(key: 'balance' | 'value'): string {
    if (!sort || sort.key !== key) return '↕';
    return sort.dir === 'desc' ? '▼' : '▲';
  }

  const totalUsd = React.useMemo(() => {
    try {
      let sum = 0;
      for (const b of displayBalances) {
        const price = pricesById[(b.token.id || '').toLowerCase()] ?? null;
        if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
        const amt = toFloatAmount(b.balance, b.token.decimals);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        sum += amt * price;
      }
      return sum;
    } catch {
      return 0;
    }
  }, [displayBalances, pricesById]);

  function isLocalAsset(url: string): boolean {
    try {
      return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
    } catch {
      return false;
    }
  }

  async function handleCopy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative p-4 bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Wallet className="h-5 w-5" />
          <span className="font-semibold">Token Balances</span>
          <span className="text-sm text-gray-500">{totalCount ? `${totalCount} total` : ''}</span>
          {Number.isFinite(totalUsd) && totalUsd > 0 ? (
            <span className="ml-2 text-sm text-gray-600">Portfolio: <span className="font-semibold">{usdFmt.format(totalUsd)}</span></span>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={hideNoPrice}
            onChange={(e) => setHideNoPrice(e.target.checked)}
            aria-label="Hide tokens without USD price"
          />
          Hide tokens without price
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">{String((error as any)?.message || error)}</div>
      )}

      <div className="overflow-x-auto md:overflow-x-visible">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TOKEN</th>
              <th
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('balance')}
                aria-sort={sort?.key === 'balance' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                title="Sort by balance"
              >
                BALANCE <span className="ml-1 opacity-70">{sortIndicator('balance')}</span>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRICE (USD)</th>
              <th
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('value')}
                aria-sort={sort?.key === 'value' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                title="Sort by value (USD)"
              >
                VALUE (USD) <span className="ml-1 opacity-70">{sortIndicator('value')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && balances.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-600">
                  <div className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span></div>
                </td>
              </tr>
            ) : balances.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-600">No ERC20 balances found for this address.</td>
              </tr>
            ) : (
              displayBalances.map((b) => {
                const amount = formatTokenAmount(b.balance, b.token.decimals, b.token.name);
                return (
                  <tr key={b.token.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleCopy(b.token.id)}
                              className="group inline-flex items-center gap-3 hover:text-blue-600 focus:outline-none"
                              title={b.token.id}
                              aria-label="Copy token contract address"
                            >
                              {(() => {
                                const sym = (b.token.name || '').toUpperCase();
                                const fallbacks = TOKEN_LOGO_FALLBACKS[sym] || [];
                                const tokenIdLower = (b.token.id || '').toLowerCase();
                                const overrideList = TOKEN_LOGO_OVERRIDES[tokenIdLower] ?? [];
                                const fromQuery = iconsById[b.token.id];
                                // Источники: Локальные → IPFS (через шлюзы)
                                const raw = [fromQuery, ...overrideList, b.token.image, ...fallbacks].filter(Boolean) as string[];
                                const dedup = new Set<string>();
                                const localSources: string[] = [];
                                const ipfsSources: string[] = [];
                                for (const u of raw) {
                                  if (isLocalAsset(u)) {
                                    if (!dedup.has(u)) { dedup.add(u); localSources.push(u); }
                                  } else if (isIpfsLike(u)) {
                                    for (const c of buildCandidates(u)) {
                                      if (!dedup.has(c)) { dedup.add(c); ipfsSources.push(c); }
                                    }
                                  }
                                }
                                const sources = [...localSources, ...ipfsSources];
                                if (sources.length > 0) {
                                  return (
                                    <img
                                      src={sources[0]!}
                                      data-idx={0}
                                      alt={`${b.token.name} icon`}
                                      loading="lazy"
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                      className="h-6 w-6 rounded-full object-cover border border-gray-200"
                                      onError={(e) => {
                                        const img = e.currentTarget as HTMLImageElement & { dataset: { idx?: string } };
                                        const i = Number(img.dataset.idx ?? '0');
                                        const next = i + 1;
                                        if (next < sources.length) {
                                          img.dataset.idx = String(next);
                                          img.src = sources[next]!;
                                        } else {
                                          // All sources failed — replace with initials badge
                                          try {
                                            const fallback = document.createElement('div');
                                            fallback.className = 'flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold';
                                            const text = (b.token.name || '?').slice(0, 2).toUpperCase();
                                            fallback.textContent = text;
                                            img.replaceWith(fallback);
                                          } catch {
                                            img.style.display = 'none';
                                          }
                                        }
                                      }}
                                    />
                                  );
                                }
                                return (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                                    {(b.token.name || '?').slice(0, 2).toUpperCase()}
                                  </div>
                                );
                              })()}
                              <div className="flex flex-col items-start">
                                <span className="font-medium text-gray-800">{b.token.name}</span>
                                <span className="text-xs text-gray-500 break-all inline-flex items-center gap-1">
                                  {copied === b.token.id ? (
                                    <>
                                      <Check className="h-3 w-3 text-green-600" />
                                      <span className="text-green-600">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-mono">{shortenHash(b.token.id, 6, 6)}</span>
                                      <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                                    </>
                                  )}
                                </span>
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>Click to copy contract</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-4 py-3">{amount}</td>
                    {(() => {
                      const price = pricesById[(b.token.id || '').toLowerCase()] ?? null;
                      const amt = toFloatAmount(b.balance, b.token.decimals);
                      const value = price ? amt * price : null;
                      return (
                        <>
                          <td className="px-4 py-3">
                            {price ? (
                              usdFmt.format(price)
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-400">—</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span>No price: no REEF pair or low liquidity</span>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </td>
                          <td className="px-4 py-3">{value ? usdFmt.format(value) : '—'}</td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

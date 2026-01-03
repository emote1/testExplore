import { toFloatAmount } from '@/utils/token-helpers';
import { Loader2, Wallet, Copy, Check } from 'lucide-react';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { formatTokenAmount } from '@/utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import React from 'react';
import { shortenHash } from '@/utils/formatters';
import { useTokenIcons } from '@/hooks/use-token-icons';
import { isIpfsLike, buildCandidates } from '@/utils/ipfs';
import { useTokenUsdPrices } from '@/hooks/use-token-usd-prices';

interface BalanceRowProps {
  balance: any;
  index: number;
  price: number | null;
  valueUsd: number | null;
  amount: string;
  copied: string | null;
  handleCopy: (id: string) => void;
  iconsById: Record<string, string | undefined>;
  TOKEN_LOGO_FALLBACKS: Record<string, string[]>;
  TOKEN_LOGO_OVERRIDES: Record<string, string[]>;
  isLocalAsset: (url: string) => boolean;
  usdFmt: Intl.NumberFormat;
}

const BalanceRow = React.memo(function BalanceRow({
  balance: b,
  index,
  price,
  valueUsd,
  amount,
  copied,
  handleCopy,
  iconsById,
  TOKEN_LOGO_FALLBACKS,
  TOKEN_LOGO_OVERRIDES,
  isLocalAsset,
  usdFmt,
}: BalanceRowProps) {
  return (
    <tr
      key={b.token.id}
      className={`group transition-colors transition-transform duration-200 hover:bg-gray-50 hover:-translate-y-px ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
    >
      <td className="px-4 py-5 whitespace-nowrap">
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
                  <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                    <span className="font-mono">{shortenHash(b.token.id, 6, 6)}</span>
                    {copied === b.token.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-600" />
                    )}
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="break-all">{b.token.id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-4 py-5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-medium tabular-nums text-gray-900">{amount}</span>
        </div>
      </td>
      <td className="px-2 py-5 whitespace-nowrap text-right">
        {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
          <span className="tabular-nums">{usdFmt.format(price)}</span>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
      <td className="px-2 py-5 whitespace-nowrap text-right">
        {typeof valueUsd === 'number' && Number.isFinite(valueUsd) && valueUsd > 0 ? (
          <span className="font-semibold tabular-nums">{usdFmt.format(valueUsd)}</span>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
    </tr>
  );
});

interface BalancesTableProps {
  address: string;
  onCountsChange?: (count: number) => void;
}

export function BalancesTable({ address, onCountsChange }: BalancesTableProps) {
  const { balances, loading, error, totalCount } = useTokenBalances(address, 50);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [hideNoPrice, setHideNoPrice] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: 'balance' | 'value'; dir: 'asc' | 'desc' } | null>(null);

  const sortBadge = React.useMemo(() => {
    if (!sort) return null;
    const label = sort.key === 'balance' ? 'Balance' : 'Value';
    return `${label} ${sort.dir === 'desc' ? '↓' : '↑'}`;
  }, [sort]);

  React.useEffect(() => {
    if (!onCountsChange) return;
    if (loading && typeof totalCount !== 'number') return;
    const value = typeof totalCount === 'number' ? totalCount : balances.length;
    if (!Number.isFinite(value)) return;
    onCountsChange(value);
  }, [onCountsChange, loading, totalCount, balances.length]);

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
    <div className="relative p-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {sortBadge ? (
        <div className="absolute top-2 right-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
            Sorted by {sortBadge}
          </span>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
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
          <thead className="bg-slate-50">
            <tr className="border-b-2 border-slate-200">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em] font-sans">TOKEN</th>
              <th
                className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em] font-sans cursor-pointer select-none"
                onClick={() => toggleSort('balance')}
                aria-sort={sort?.key === 'balance' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                title="Sort by balance"
              >
                BALANCE <span className="ml-1 opacity-70">{sortIndicator('balance')}</span>
              </th>
              <th className="px-2 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em] font-sans">PRICE (USD)</th>
              <th
                className="px-2 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em] font-sans cursor-pointer select-none"
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
              displayBalances.map((b, index) => {
                const amount = formatTokenAmount(b.balance, b.token.decimals, b.token.name);
                const lowerId = (b.token.id || '').toLowerCase();
                const price = pricesById[lowerId] ?? null;
                const amt = toFloatAmount(b.balance, b.token.decimals);
                const valueUsd = typeof price === 'number' && Number.isFinite(price) && price > 0 ? amt * price : null;
                return (
                  <BalanceRow
                    key={b.token.id}
                    balance={b}
                    index={index}
                    price={price}
                    valueUsd={valueUsd}
                    amount={amount}
                    copied={copied}
                    handleCopy={handleCopy}
                    iconsById={iconsById}
                    TOKEN_LOGO_FALLBACKS={TOKEN_LOGO_FALLBACKS}
                    TOKEN_LOGO_OVERRIDES={TOKEN_LOGO_OVERRIDES}
                    isLocalAsset={isLocalAsset}
                    usdFmt={usdFmt}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

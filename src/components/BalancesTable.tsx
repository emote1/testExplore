import { toFloatAmount } from '@/utils/token-helpers';
import { Wallet, Copy, Check } from 'lucide-react';
import { EmptyState } from './ui/empty-state';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { formatTokenAmount } from '@/utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import React from 'react';
import { shortenHash } from '@/utils/formatters';
import { useTokenIcons } from '@/hooks/use-token-icons';
import { isIpfsLike, buildCandidates } from '@/utils/ipfs';
import { getTokenIdenticon } from '@/utils/token-identicon';
import { useTokenUsdPrices } from '@/hooks/use-token-usd-prices';

interface TokenIconProps {
  tokenName: string;
  tokenId: string;
  tokenImage?: string;
  iconsById: Record<string, string | undefined>;
  TOKEN_LOGO_FALLBACKS: Record<string, string[]>;
  TOKEN_LOGO_OVERRIDES: Record<string, string[]>;
  isLocalAsset: (url: string) => boolean;
}

const TokenIcon = React.memo(function TokenIcon({
  tokenName,
  tokenId,
  tokenImage,
  iconsById,
  TOKEN_LOGO_FALLBACKS,
  TOKEN_LOGO_OVERRIDES,
  isLocalAsset,
}: TokenIconProps) {
  const sources = React.useMemo(() => {
    const sym = (tokenName || '').toUpperCase();
    const fallbacks = TOKEN_LOGO_FALLBACKS[sym] || [];
    const tokenIdLower = (tokenId || '').toLowerCase();
    const overrideList = TOKEN_LOGO_OVERRIDES[tokenIdLower] ?? [];
    const fromQuery = iconsById[tokenId];
    const raw = [fromQuery, ...overrideList, tokenImage, ...fallbacks].filter(Boolean) as string[];
    const dedup = new Set<string>();
    const localSources: string[] = [];
    const remoteSources: string[] = [];
    const ipfsSources: string[] = [];
    for (const u of raw) {
      if (isLocalAsset(u)) {
        if (!dedup.has(u)) { dedup.add(u); localSources.push(u); }
      } else if (isIpfsLike(u)) {
        for (const c of buildCandidates(u)) {
          if (!dedup.has(c)) { dedup.add(c); ipfsSources.push(c); }
        }
      } else if (u.startsWith('http')) {
        if (!dedup.has(u)) { dedup.add(u); remoteSources.push(u); }
      }
    }
    return [...localSources, ...remoteSources, ...ipfsSources];
  }, [tokenName, tokenId, tokenImage, iconsById, TOKEN_LOGO_FALLBACKS, TOKEN_LOGO_OVERRIDES, isLocalAsset]);

  const [srcIdx, setSrcIdx] = React.useState(0);
  const [allFailed, setAllFailed] = React.useState(false);

  React.useEffect(() => {
    setSrcIdx(0);
    setAllFailed(false);
  }, [sources]);

  // Deterministic SVG identicon from contract address (same approach as reef-chain/react-lib)
  const identiconSrc = React.useMemo(() => getTokenIdenticon(tokenId), [tokenId]);

  if (sources.length === 0 || allFailed) {
    return (
      <img
        src={identiconSrc}
        alt={`${tokenName} icon`}
        className="h-6 w-6 rounded-full"
      />
    );
  }

  return (
    <img
      src={sources[srcIdx]!}
      alt={`${tokenName} icon`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-6 w-6 rounded-full object-cover border border-border"
      onError={() => {
        const next = srcIdx + 1;
        if (next < sources.length) {
          setSrcIdx(next);
        } else {
          setAllFailed(true);
        }
      }}
    />
  );
});

interface BalanceRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      className={`group transition-colors transition-transform duration-200 hover:bg-muted hover:-translate-y-px ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
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
                <TokenIcon
                  tokenName={b.token.name}
                  tokenId={b.token.id}
                  tokenImage={b.token.image}
                  iconsById={iconsById}
                  TOKEN_LOGO_FALLBACKS={TOKEN_LOGO_FALLBACKS}
                  TOKEN_LOGO_OVERRIDES={TOKEN_LOGO_OVERRIDES}
                  isLocalAsset={isLocalAsset}
                />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-foreground">{b.token.name}</span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <span className="font-mono">{shortenHash(b.token.id, 6, 6)}</span>
                    {copied === b.token.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-600" />
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
          <span className="font-medium tabular-nums text-foreground">{amount}</span>
        </div>
      </td>
      <td className="px-2 py-5 whitespace-nowrap text-right">
        {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
          <span className="tabular-nums">{usdFmt.format(price)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-5 whitespace-nowrap text-right">
        {typeof valueUsd === 'number' && Number.isFinite(valueUsd) && valueUsd > 0 ? (
          <span className="font-semibold tabular-nums">{usdFmt.format(valueUsd)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
});

interface BalanceCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balance: any;
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

const BalanceCard = React.memo(function BalanceCard({
  balance: b,
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
}: BalanceCardProps) {
  return (
    <div
      className="flex items-center gap-3 p-4 border-b border-border hover:bg-muted transition-colors"
    >
      <button
        type="button"
        onClick={() => handleCopy(b.token.id)}
        className="flex-shrink-0 focus:outline-none"
        title={b.token.id}
        aria-label="Copy token contract address"
      >
        <TokenIcon
          tokenName={b.token.name}
          tokenId={b.token.id}
          tokenImage={b.token.image}
          iconsById={iconsById}
          TOKEN_LOGO_FALLBACKS={TOKEN_LOGO_FALLBACKS}
          TOKEN_LOGO_OVERRIDES={TOKEN_LOGO_OVERRIDES}
          isLocalAsset={isLocalAsset}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">{b.token.name}</span>
          <span className="text-xs text-muted-foreground font-mono">{shortenHash(b.token.id, 4, 4)}</span>
          {copied === b.token.id ? (
            <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
          ) : null}
        </div>
        <div className="text-sm tabular-nums text-foreground font-medium">{amount}</div>
      </div>
      <div className="text-right flex-shrink-0">
        {typeof valueUsd === 'number' && Number.isFinite(valueUsd) && valueUsd > 0 ? (
          <div className="text-sm font-semibold tabular-nums text-foreground">{usdFmt.format(valueUsd)}</div>
        ) : null}
        {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
          <div className="text-xs text-muted-foreground tabular-nums">{usdFmt.format(price)}/unit</div>
        ) : null}
      </div>
    </div>
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
    '0x7922d8785d93e692bb584e659b607fa821e6a91a': [
      '/token-logos/usdc.svg',
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

  const isLocalAsset = React.useCallback(function isLocalAsset(url: string): boolean {
    try {
      return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
    } catch {
      return false;
    }
  }, [])

  const handleCopy = React.useCallback(async function handleCopy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="relative p-6 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {sortBadge ? (
        <div className="absolute top-2 right-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
            Sorted by {sortBadge}
          </span>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5" />
          <span className="font-semibold">Token Balances</span>
          <span className="text-sm text-muted-foreground">{totalCount ? `${totalCount} total` : ''}</span>
          {Number.isFinite(totalUsd) && totalUsd > 0 ? (
            <span className="ml-2 text-sm text-muted-foreground">Portfolio: <span className="font-semibold text-foreground">{usdFmt.format(totalUsd)}</span></span>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <div className="mb-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-red-800 dark:text-red-200">{String((error as any)?.message || error)}</div>
      )}

      {loading && (
        <div className="hidden sm:block">
          <table className="w-full table-fixed divide-y divide-border">
            <thead className="bg-muted">
              <tr className="border-b-2 border-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">TOKEN</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">BALANCE</th>
                <th className="px-2 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">PRICE (USD)</th>
                <th className="px-2 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">VALUE (USD)</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={`bal-skel-${i}`} className="animate-pulse">
                  <td className="px-4 py-5"><div className="flex items-center gap-3"><div className="h-6 w-6 bg-muted rounded-full" /><div><div className="h-4 w-20 bg-muted rounded mb-1" /><div className="h-3 w-24 bg-muted rounded" /></div></div></td>
                  <td className="px-4 py-5"><div className="h-4 w-24 bg-muted rounded" /></td>
                  <td className="px-2 py-5 text-right"><div className="h-4 w-16 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-5 text-right"><div className="h-4 w-20 bg-muted rounded ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && (
        <div className="sm:hidden divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`bal-skel-card-${i}`} className="flex items-center gap-3 p-4 animate-pulse">
              <div className="h-6 w-6 bg-muted rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-20 bg-muted rounded mb-1" />
                <div className="h-3 w-28 bg-muted rounded" />
              </div>
              <div className="text-right flex-shrink-0">
                <div className="h-4 w-16 bg-muted rounded mb-1" />
                <div className="h-3 w-12 bg-muted rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: table layout */}
      {!loading && <div className="hidden sm:block">
        <div className="overflow-x-auto md:overflow-x-visible">
          <table className="w-full table-fixed divide-y divide-border">
            <thead className="bg-muted">
              <tr className="border-b-2 border-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">TOKEN</th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans cursor-pointer select-none"
                  onClick={() => toggleSort('balance')}
                  aria-sort={sort?.key === 'balance' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title="Sort by balance"
                >
                  BALANCE <span className="ml-1 opacity-70">{sortIndicator('balance')}</span>
                </th>
                <th className="px-2 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans">PRICE (USD)</th>
                <th
                  className="px-2 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] font-sans cursor-pointer select-none"
                  onClick={() => toggleSort('value')}
                  aria-sort={sort?.key === 'value' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title="Sort by value (USD)"
                >
                  VALUE (USD) <span className="ml-1 opacity-70">{sortIndicator('value')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={Wallet}
                      title="No token balances found"
                      description="No token balances found for this address."
                    />
                  </td>
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
      </div>}

      {/* Mobile: card layout */}
      {!loading && <div className="sm:hidden">
        {balances.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No token balances found"
            description="No token balances found for this address."
          />
        ) : (
          <div className="divide-y divide-border">
            {displayBalances.map((b) => {
              const amount = formatTokenAmount(b.balance, b.token.decimals, b.token.name);
              const lowerId = (b.token.id || '').toLowerCase();
              const price = pricesById[lowerId] ?? null;
              const amt = toFloatAmount(b.balance, b.token.decimals);
              const valueUsd = typeof price === 'number' && Number.isFinite(price) && price > 0 ? amt * price : null;
              return (
                <BalanceCard
                  key={b.token.id}
                  balance={b}
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
            })}
          </div>
        )}
      </div>}
    </div>
  );
}

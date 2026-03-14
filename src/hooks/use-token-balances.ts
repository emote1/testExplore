import { useEffect, useMemo, useState } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useQuery } from '@apollo/client';
import { ACCOUNT_NATIVE_BALANCE_QUERY, TOKEN_HOLDERS_PAGED_QUERY, mapTokenHoldersToUiBalances, type UiTokenBalance } from '@/data/balances';
import { useAddressResolver } from './use-address-resolver';
import { isValidSubstrateAddressFormat } from '@/utils/address-helpers';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

export interface UseTokenBalancesReturn {
  balances: UiTokenBalance[];
  loading: boolean;
  error?: Error;
  totalCount?: number;
}

export function useTokenBalances(address: string | null | undefined, first = 50): UseTokenBalancesReturn {
  const REEF_TOKEN_ID = '0x0000000000000000000000000000000001000000';
  const { resolveAddress } = useAddressResolver();
  const [resolved, setResolved] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const trimmedAddress = (address ?? '').trim();
  const queryAccountId = resolved ?? (isValidSubstrateAddressFormat(trimmedAddress) ? trimmedAddress : null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) { setResolved(null); return; }
      setIsResolving(true);
      try {
        const native = await resolveAddress(address);
        if (!active) return;
        setResolved(native);
      } catch {
        if (!active) return;
        setResolved(null);
      } finally {
        if (active) setIsResolving(false);
      }
    })();
    return () => { active = false; };
  }, [address, resolveAddress]);

  const { data: erc20Data, loading: erc20Loading, error: erc20Error } = useQuery(
    TOKEN_HOLDERS_PAGED_QUERY as unknown as TypedDocumentNode,
    {
      variables: { accountId: queryAccountId, first },
      skip: !queryAccountId || isResolving,
      fetchPolicy: 'cache-first',
    }
  );

  const { data: nativeData, loading: nativeLoading, error: nativeError } = useQuery(
    ACCOUNT_NATIVE_BALANCE_QUERY as unknown as TypedDocumentNode,
    {
      variables: { accountId: queryAccountId },
      skip: isHasuraExplorerMode || !queryAccountId || isResolving,
      fetchPolicy: 'cache-first',
    }
  );

  const balances = useMemo<UiTokenBalance[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (erc20Data ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges = source?.tokenHolders?.edges ?? (source?.tokenHolders ?? []).map((node: any) => ({ node }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const erc20Balances = mapTokenHoldersToUiBalances(edges as Array<{ node?: any } | null>);
    const hasReefFromTokenHolders = erc20Balances.some(
      (b) => String(b?.token?.id ?? '').toLowerCase() === REEF_TOKEN_ID
    );
    if (hasReefFromTokenHolders) return erc20Balances;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeSource = (nativeData ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = (nativeSource?.accounts ?? [])[0] as any;
    const nativeRaw = String(account?.availableBalance ?? account?.freeBalance ?? '0');
    let nativePositive = false;
    try {
      nativePositive = BigInt(nativeRaw) > 0n;
    } catch {
      nativePositive = false;
    }
    if (!nativePositive) return erc20Balances;

    const reefBalance: UiTokenBalance = {
      token: { id: REEF_TOKEN_ID, name: 'REEF', decimals: 18, image: '/token-logos/reef.png' },
      balance: nativeRaw,
    };

    return [reefBalance, ...erc20Balances];
  }, [erc20Data, nativeData]);

  const totalCount = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (erc20Data ?? {}) as any;
    const raw = Number(source?.tokenHolders?.totalCount ?? source?.tokenHoldersAggregate?.aggregate?.count);
    const erc20Count = Number.isFinite(raw)
      ? raw
      : (Array.isArray(source?.tokenHolders) ? source.tokenHolders.length : 0);
    const hasReefFromTokenHolders = Array.isArray(source?.tokenHolders) && source.tokenHolders.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => String(n?.token_id ?? n?.node?.token?.id ?? '').toLowerCase() === REEF_TOKEN_ID
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeSource = (nativeData ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = (nativeSource?.accounts ?? [])[0] as any;
    const nativeRaw = String(account?.availableBalance ?? account?.freeBalance ?? '0');
    let nativeCount = 0;
    try {
      nativeCount = hasReefFromTokenHolders ? 0 : (BigInt(nativeRaw) > 0n ? 1 : 0);
    } catch {
      nativeCount = 0;
    }

    return erc20Count + nativeCount;
  }, [erc20Data, nativeData]);

  const loading = isResolving || erc20Loading || nativeLoading;
  const error = (erc20Error ?? nativeError) as Error | undefined;

  return { balances, loading, error, totalCount };
}

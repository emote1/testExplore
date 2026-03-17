import { useEffect, useMemo, useState } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useQuery } from '@apollo/client';
import { ACCOUNT_NATIVE_BALANCE_QUERY, TOKEN_HOLDERS_PAGED_QUERY, mapTokenHoldersToUiBalances, type UiTokenBalance } from '@/data/balances';
import { useAddressResolver } from './use-address-resolver';
import { isValidSubstrateAddressFormat, toChecksumAddress } from '@/utils/address-helpers';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

export interface UseTokenBalancesReturn {
  balances: UiTokenBalance[];
  loading: boolean;
  error?: Error;
  totalCount?: number;
}

export function useTokenBalances(address: string | null | undefined, first = 50): UseTokenBalancesReturn {
  const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
  const REEF_TOKEN_ID = '0x0000000000000000000000000000000001000000';
  const HASURA_HTTP_URL = ENV.VITE_REEF_EXPLORER_HTTP_URL ?? '/api/reef-explorer';
  const { resolveBoth } = useAddressResolver();
  const [resolvedNative, setResolvedNative] = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [evmFallbackLoading, setEvmFallbackLoading] = useState(false);

  const trimmedAddress = (address ?? '').trim();
  const isInputEvm = /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress);
  const queryAccountId = resolvedNative ?? (isValidSubstrateAddressFormat(trimmedAddress) ? trimmedAddress : null);
  const queryEvmAddressLower = (resolvedEvm ?? (isInputEvm ? trimmedAddress.toLowerCase() : '')).toLowerCase();
  const queryEvmAddress = queryEvmAddressLower ? toChecksumAddress(queryEvmAddressLower) : '';
  const safeAccountIdVar = queryAccountId ?? '';
  const hasuraCanQueryByAddress = !!queryAccountId || !!queryEvmAddressLower;
  const canRunErc20Query = isHasuraExplorerMode
    ? hasuraCanQueryByAddress
    : (!!queryAccountId && !isResolving);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) {
        setResolvedNative(null);
        setResolvedEvm(null);
        return;
      }
      setIsResolving(true);
      try {
        const { nativeId, evmAddress } = await resolveBoth(address);
        if (!active) return;
        setResolvedNative(nativeId);
        const evmLower = evmAddress ? evmAddress.toLowerCase() : null;
        setResolvedEvm(evmLower);
      } catch {
        if (!active) return;
        setResolvedNative(null);
        setResolvedEvm(null);
      } finally {
        if (active) setIsResolving(false);
      }
    })();
    return () => { active = false; };
  }, [address, resolveBoth]);

  const { data: erc20Data, loading: erc20Loading, error: erc20Error } = useQuery(
    TOKEN_HOLDERS_PAGED_QUERY as unknown as TypedDocumentNode,
    {
      variables: { accountId: safeAccountIdVar, evmAddress: queryEvmAddress, evmAddressLower: queryEvmAddressLower, first },
      skip: !canRunErc20Query,
      fetchPolicy: 'network-only',
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

  useEffect(() => {
    if (!isHasuraExplorerMode) return;
    if (resolvedEvm) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (erc20Data ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = source?.tokenHolders?.edges?.map((e: any) => e?.node) ?? (Array.isArray(source?.tokenHolders) ? source.tokenHolders : []);
    const evmFromRows = (Array.isArray(rows) ? rows : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => String(n?.evm_address ?? n?.signer?.evmAddress ?? '').trim()
    ).find((v) => /^0x[a-fA-F0-9]{40}$/.test(v));
    if (!evmFromRows) return;
    setResolvedEvm(evmFromRows.toLowerCase());
  }, [erc20Data, resolvedEvm]);

  const primaryErc20Balances = useMemo<UiTokenBalance[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (erc20Data ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges = source?.tokenHolders?.edges ?? (source?.tokenHolders ?? []).map((node: any) => ({ node }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapTokenHoldersToUiBalances(edges as Array<{ node?: any } | null>);
  }, [erc20Data]);

  useEffect(() => {
    let active = true;
    (async () => {
      setEvmFallbackLoading(false);
      if (!isHasuraExplorerMode) return;
      if (!queryAccountId) return;
      if (resolvedEvm) return;
      if (primaryErc20Balances.length > 1) return;
      setEvmFallbackLoading(true);
      try {
        const query = `
          query ResolveEvmByNative($accountId: String!) {
            outgoing: transfer(
              where: { from_id: { _eq: $accountId }, from_evm_address: { _is_null: false } }
              order_by: [{ timestamp: desc }]
              limit: 1
            ) {
              evm: from_evm_address
            }
            incoming: transfer(
              where: { to_id: { _eq: $accountId }, to_evm_address: { _is_null: false } }
              order_by: [{ timestamp: desc }]
              limit: 1
            ) {
              evm: to_evm_address
            }
            staking: staking_activity(
              where: { signer_id: { _eq: $accountId }, signer_evm_address: { _is_null: false } }
              order_by: [{ timestamp: desc }]
              limit: 1
            ) {
              evm: signer_evm_address
            }
          }
        `;
        const resp = await fetch(HASURA_HTTP_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables: { accountId: queryAccountId } }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const candidates = [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          String((json as any)?.data?.outgoing?.[0]?.evm ?? '').trim(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          String((json as any)?.data?.incoming?.[0]?.evm ?? '').trim(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          String((json as any)?.data?.staking?.[0]?.evm ?? '').trim(),
        ].filter((v) => /^0x[a-fA-F0-9]{40}$/.test(v));
        if (!active) return;
        if (candidates.length > 0) {
          setResolvedEvm(candidates[0]!.toLowerCase());
        }
      } catch {
        // ignore
      } finally {
        if (active) setEvmFallbackLoading(false);
      }
    })();
    return () => { active = false; };
  }, [HASURA_HTTP_URL, primaryErc20Balances.length, queryAccountId, resolvedEvm]);

  const balances = useMemo<UiTokenBalance[]>(() => {
    const erc20Balances = primaryErc20Balances;
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
  }, [nativeData, primaryErc20Balances]);

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

  const loading = isResolving || erc20Loading || nativeLoading || evmFallbackLoading;
  const error = (erc20Error ?? nativeError) as Error | undefined;

  return { balances, loading, error, totalCount };
}

import { useEffect, useState } from 'react';
import { apolloClient } from '@/apollo-client';
import { gql } from '@apollo/client';

const REEF_TOTAL_SUPPLY = 20_000_000_000; // 20B REEF

const ERA_VALIDATORS_QUERY = gql`
  query LatestEraValidators {
    eraValidatorInfos(orderBy: era_DESC, limit: 200) {
      era
      address
      total
    }
  }
`;

interface ValidatorInfo {
  era: number;
  address: string;
  total: string;
}

interface TotalStakedState {
  loading: boolean;
  error?: Error;
  totalStakedRaw: bigint;
  totalStakedReef: number;
  stakedPct: number;
  validatorCount: number;
  era: number | null;
}

function bigIntToReef(raw: bigint): number {
  return Number(raw / 100000000000000n) / 1e4;
}

export function useTotalStaked(): TotalStakedState {
  const [state, setState] = useState<TotalStakedState>({
    loading: true,
    error: undefined,
    totalStakedRaw: 0n,
    totalStakedReef: 0,
    stakedPct: 0,
    validatorCount: 0,
    era: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        const { data } = await apolloClient.query({
          query: ERA_VALIDATORS_QUERY,
          fetchPolicy: 'network-only',
        });

        if (cancelled) return;

        const validators = (data?.eraValidatorInfos ?? []) as ValidatorInfo[];
        if (validators.length === 0) {
          setState({
            loading: false,
            error: undefined,
            totalStakedRaw: 0n,
            totalStakedReef: 0,
            stakedPct: 0,
            validatorCount: 0,
            era: null,
          });
          return;
        }

        const latestEra = validators[0].era;
        const eraValidators = validators.filter((v) => v.era === latestEra);

        let totalStakedRaw = 0n;
        for (const v of eraValidators) {
          totalStakedRaw += BigInt(v.total);
        }

        const totalStakedReef = bigIntToReef(totalStakedRaw);
        const stakedPct = (totalStakedReef / REEF_TOTAL_SUPPLY) * 100;

        setState({
          loading: false,
          error: undefined,
          totalStakedRaw,
          totalStakedReef,
          stakedPct,
          validatorCount: eraValidators.length,
          era: latestEra,
        });
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        }));
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}

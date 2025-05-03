import { useEffect, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';

const GET_FEE = gql`
  query GetFee($hash: String!) {
    events(
      where: {
        section_eq: "balances"
        method_eq: "Withdraw"
        extrinsic: { hash_eq: $hash }
      }
    ) {
      data
    }
  }
`;

export function useFee(extrinsicHash?: string): number | undefined {
  const [fee, setFee] = useState<number | undefined>(undefined);
  const [fetchFee, { data }] = useLazyQuery(GET_FEE);

  useEffect(() => {
    if (extrinsicHash) {
      fetchFee({ variables: { hash: extrinsicHash } });
    }
  }, [extrinsicHash, fetchFee]);

  useEffect(() => {
    if (data?.events?.[0]?.data) {
      // Найти первое число, которое похоже на комиссию (меньше 1 REEF)
      const feeValue = data.events[0].data
        .map((v: string) => Number(v) / 1e18)
        .find((v: number) => v > 0 && v < 1); // комиссия всегда меньше 1 REEF
      if (feeValue !== undefined) setFee(feeValue);
    }
  }, [data]);

  return fee;
}

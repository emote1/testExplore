import { useEffect, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';

const GET_EXTRINSIC_DETAILS_WITH_EVENTS = gql`
  query GetExtrinsicDetailsWithEvents($extrinsicId: String!) {
    extrinsics(where: { id_eq: $extrinsicId }, limit: 1) {
      id
      hash
      block { id timestamp } 
      index
      signer 
      method
      section
      args 
      status
      timestamp 
      events(limit: 50, orderBy: index_ASC) { 
        id
        method 
        section 
        data 
        phase
        index 
      }
    }
  }
`;

interface Event {
  id: string;
  method: string;
  section: string;
  data: any; 
  phase: string;
  index: number;
}

interface Extrinsic {
  id: string;
  hash: string;
  block: { id: string; timestamp?: string }; 
  index?: number;
  signer?: string; 
  method?: string;
  section?: string;
  args: any; 
  status: string; 
  timestamp?: string;
  events: Event[];
}

interface FullExtrinsicResponse {
  extrinsics: Extrinsic[];
}

export const useFee = (extrinsicId: string | undefined) => {
  console.log(`[useFee ExtrinsicEvents] Hook called. Extrinsic ID: ${extrinsicId}`);
  const [fee, setFee] = useState<number | undefined>(undefined);
  
  const [fetchDetails, { loading, error }] = useLazyQuery<FullExtrinsicResponse>(GET_EXTRINSIC_DETAILS_WITH_EVENTS, {
    onCompleted: (data) => {
      if (data && data.extrinsics && data.extrinsics.length > 0) {
        const extrinsic = data.extrinsics[0];

        let feeValue: number | undefined = undefined;

        const feePaidEvent = extrinsic.events.find(
          (event: Event) => event.section === 'transactionpayment' && event.method === 'TransactionFeePaid'
        );

        if (feePaidEvent) {
          if (Array.isArray(feePaidEvent.data) && feePaidEvent.data.length > 1) {
            const feeValueStr = feePaidEvent.data[1]?.toString(); 
            if (feeValueStr) feeValue = parseInt(feeValueStr, 10);
          } else if (typeof feePaidEvent.data === 'object' && feePaidEvent.data !== null) {
            const feeValueStr = feePaidEvent.data.actualFee?.toString() || feePaidEvent.data.fee?.toString();
            if (feeValueStr) feeValue = parseInt(feeValueStr, 10);
          }
          if (feeValue !== undefined) {
            console.log(`[useFee] Fee for ${extrinsicId}: ${feeValue} (from TransactionFeePaid event)`);
          }
        }

        // TODO: Рассмотреть Balances.Withdraw от signerId как возможный источник комиссии, если другие не найдены
        if (feeValue !== undefined && !isNaN(feeValue)) {
          setFee(feeValue);
        } else {
          console.log(`[useFee] Fee NOT FOUND for ${extrinsicId}`);
          setFee(undefined); 
        }
      } else {
        console.log(`[useFee] No extrinsic details found for ${extrinsicId}`);
        setFee(undefined);
      }
    },
    onError: (error) => {
      console.error(`[useFee] Error fetching details for Extrinsic ID ${extrinsicId}:`, error);
      setFee(undefined);
    }
  });

  useEffect(() => {
    if (extrinsicId) {
      fetchDetails({ variables: { extrinsicId } });
    } else {
      setFee(undefined); 
    }
  }, [extrinsicId, fetchDetails]);

  return { fee, loading, error };
};

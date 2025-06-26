import { describe, it, expect } from 'vitest';
import { mapTransfersToUiTransfers } from './transfer-mapper';
import type {
  TransfersQueryQuery as TransfersQuery,
  Transfer,
  Account,
  VerifiedContract,
  TransferType,
  ExtrinsicsByIdsQuery,
} from '../types/graphql-generated';

type TransferEdge = TransfersQuery['transfersConnection']['edges'][0];
type Extrinsic = ExtrinsicsByIdsQuery['extrinsics'][0];

const USER_ADDRESS = '5G1kG9y9Qtnk2WPSb1d1A2x3s4e5U6f7G8h9iJ0kL1m2n3o4';
const ANOTHER_ADDRESS = '5AnotherAddressForTestingPurpose';

const createMockAccount = (id: string): Account => ({
  __typename: 'Account',
  id,
  ...({} as Omit<Account, '__typename' | 'id'>),
});

const createMockVerifiedContract = (
  name: string,
  contractData?: any,
): VerifiedContract => ({
  __typename: 'VerifiedContract',
  id: 'contract-id',
  name,
  contractData,
  ...({} as Omit<VerifiedContract, '__typename' | 'id' | 'name' | 'contractData'>),
});

const createMockTransferEdge = (
  id: string,
  timestamp: string,
  type: TransferType,
  amount: string,
  fromAddress: string,
  toAddress: string,
  tokenName: string,
  success: boolean,
  extrinsicHash?: string,
  extrinsicId?: string,
  contractData?: any,
): TransferEdge => {
  const transfer: Transfer = {
    __typename: 'Transfer',
    id,
    amount,
    timestamp,
    success,
    type,
    extrinsicHash: extrinsicHash || `0xhash-${id}`,
    extrinsicId: extrinsicId || `extrinsic-id-${id}`,
    from: createMockAccount(fromAddress),
    to: createMockAccount(toAddress),
    token: createMockVerifiedContract(tokenName, contractData),
    ...({} as Omit<
      Transfer,
      | '__typename'
      | 'id'
      | 'amount'
      | 'timestamp'
      | 'success'
      | 'type'
      | 'extrinsicHash'
      | 'extrinsicId'
      | 'from'
      | 'to'
      | 'token'
    >),
  };

  return {
    __typename: 'TransferEdge',
    node: transfer,
    ...({} as Omit<TransferEdge, '__typename' | 'node'>),
  };
};

const createMockExtrinsic = (id: string, partialFeeHex: string): Extrinsic => ({
  __typename: 'Extrinsic',
  id,
  signedData: {
    __typename: 'SignedData',
    fee: {
      __typename: 'Fee',
      partialFee: partialFeeHex,
    },
  },
  ...({} as Omit<Extrinsic, '__typename' | 'id' | 'signedData'>),
});

describe('mapTransfersToUiTransfers', () => {
  const emptyExtrinsics: Extrinsic[] = [];

  it('should correctly map an incoming REEF transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-1',
      '2023-01-01T12:00:00.000Z',
      'Native',
      '5000',
      ANOTHER_ADDRESS,
      USER_ADDRESS,
      'REEF',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, emptyExtrinsics);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-1',
      type: 'INCOMING',
      amount: '5000',
      token: { name: 'REEF', decimals: 18 },
      fee: { amount: '0', token: { name: 'REEF', decimals: 18 } },
      success: true,
    });
  });

  it('should correctly map an outgoing REEF transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-2',
      '2023-01-02T12:00:00.000Z',
      'Native',
      '6000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'REEF',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, emptyExtrinsics);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-2',
      type: 'OUTGOING',
    });
  });

  it('should correctly map an NFT transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-nft-1',
      '2023-01-03T12:00:00.000Z',
      'ERC1155',
      '1',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'My Awesome NFT',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, emptyExtrinsics);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      token: { name: 'NFT', decimals: 0 },
    });
  });

  it('should correctly extract fee from an extrinsic', () => {
    const transfer = createMockTransferEdge(
      'transfer-fee-1',
      '2023-01-04T12:00:00.000Z',
      'Native',
      '7000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'REEF',
      true,
      '0xhash-fee-1',
      'extrinsic-id-fee-1',
    );

    const extrinsic = createMockExtrinsic(
      'extrinsic-id-fee-1',
      '0x23c34600', // 600,000,000
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, [extrinsic]);

    expect(result).toHaveLength(1);
    expect(result[0].fee.amount).toBe('600000000');
  });

  it('should return an empty array if transfers are null or undefined', () => {
    expect(mapTransfersToUiTransfers(null, USER_ADDRESS, [])).toEqual([]);
    expect(mapTransfersToUiTransfers(undefined, USER_ADDRESS, [])).toEqual([]);
  });

  it('should return an empty array if userAddress is null or undefined', () => {
    const transfer = createMockTransferEdge('t1', 'ts', 'Native', '1', 'a', 'b', 'r', true);
    expect(mapTransfersToUiTransfers([transfer], null, [])).toEqual([]);
    expect(mapTransfersToUiTransfers([transfer], undefined, [])).toEqual([]);
  });

  it('should handle failed transfers', () => {
    const transfer = createMockTransferEdge(
      'transfer-fail-1',
      '2023-01-06T12:00:00.000Z',
      'Native',
      '8000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'REEF',
      false,
    );
    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, emptyExtrinsics);
    expect(result[0].success).toBe(false);
  });

  it('should map ERC20 token transfers correctly', () => {
    const transfer = createMockTransferEdge(
      'transfer-reef20-1',
      '2023-01-07T12:00:00.000Z',
      'ERC20',
      '9000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'MyToken',
      true,
      undefined,
      undefined,
      { decimals: 10 },
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, emptyExtrinsics);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-reef20-1',
      type: 'OUTGOING',
      amount: '9000',
      token: { name: 'MyToken', decimals: 10 },
      fee: { amount: '0', token: { name: 'REEF', decimals: 18 } },
      success: true,
    });
  });

  it('should default feeAmount to "0" if extrinsic is not found', () => {
    const transfer = createMockTransferEdge(
      'transfer-no-fee',
      '2023-01-07T12:00:00.000Z',
      'Native',
      '10000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'REEF',
      true,
    );

    // Pass an empty array for extrinsics
    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-no-fee',
      type: 'OUTGOING',
      amount: '10000',
      token: { name: 'REEF', decimals: 18 },
      fee: { amount: '0', token: { name: 'REEF', decimals: 18 } },
      success: true,
    });
  });

  it('should handle empty input', () => {
    const result = mapTransfersToUiTransfers([], USER_ADDRESS, emptyExtrinsics);
    expect(result).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { mapTransfersToUiTransfers } from './transfer-mapper';
import type { TransfersQueryQuery, Transfer, Account, VerifiedContract, TransferType } from '../types/graphql-generated';

type TransferEdge = TransfersQueryQuery['transfersConnection']['edges'][0];

const USER_ADDRESS = '5G1kG9y9Qtnk2WPSb1d1A2x3s4e5U6f7G8h9iJ0kL1m2n3o4';
const ANOTHER_ADDRESS = '5AnotherAddressForTestingPurpose';

const createMockAccount = (id: string): Account => ({
  __typename: 'Account',
  id,
  // Use type assertion for complex required fields
  ...({} as Omit<Account, '__typename' | 'id'>),
});

const createMockVerifiedContract = (id: string, name: string): VerifiedContract => ({
  __typename: 'VerifiedContract',
  id,
  name,
  // Use type assertion for complex required fields
  ...({} as Omit<VerifiedContract, '__typename' | 'id' | 'name'>),
});

const createMockTransferEdge = (
  id: string,
  timestamp: string,
  type: TransferType,
  amount: string,
  fromAddress: string,
  toAddress: string,
  tokenId: string,
  tokenName: string,
  success: boolean,
  extrinsicHash?: string,
): TransferEdge => {
  const transfer: Transfer = {
    __typename: 'Transfer',
    id,
    amount,
    timestamp,
    success,
    type,
    extrinsicHash: extrinsicHash || `0xhash-${id}`,
    from: createMockAccount(fromAddress),
    to: createMockAccount(toAddress),
    token: createMockVerifiedContract(tokenId, tokenName),
    // Use type assertion for remaining required fields
    ...({} as Omit<Transfer, '__typename' | 'id' | 'amount' | 'timestamp' | 'success' | 'type' | 'extrinsicHash' | 'from' | 'to' | 'token'>),
  };

  return {
    __typename: 'TransferEdge',
    node: transfer,
    // Use type assertion for any other edge fields
    ...({} as Omit<TransferEdge, '__typename' | 'node'>),
  };
};

describe('mapTransfersToUiTransfers', () => {
  it('should correctly map a standard REEF transfer where the user is the recipient', () => {
    const transfer = createMockTransferEdge(
      'transfer-1',
      '2023-01-01T12:00:00.000Z',
      'Native',
      '5000',
      ANOTHER_ADDRESS,
      USER_ADDRESS,
      'reef-token',
      'REEF',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-1',
      hash: '0xhash-transfer-1',
      from: ANOTHER_ADDRESS,
      to: USER_ADDRESS,
      amount: '5000',
      tokenSymbol: 'REEF',
      tokenDecimals: 18,
      feeAmount: '0',
      type: 'INCOMING',
      success: true,
      status: 'Success',
    });
  });

  it('should correctly map a standard REEF transfer where the user is the sender', () => {
    const transfer = createMockTransferEdge(
      'transfer-2',
      '2023-01-02T12:00:00.000Z',
      'Native',
      '6000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'reef-token',
      'REEF',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-2',
      hash: '0xhash-transfer-2',
      from: USER_ADDRESS,
      to: ANOTHER_ADDRESS,
      amount: '6000',
      tokenSymbol: 'REEF',
      feeAmount: '0',
      type: 'OUTGOING',
    });
  });

  it('should correctly map a self-transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-3',
      '2023-01-03T12:00:00.000Z',
      'Native',
      '7000',
      USER_ADDRESS,
      USER_ADDRESS,
      'reef-token',
      'REEF',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'transfer-3', from: USER_ADDRESS, to: USER_ADDRESS, amount: '7000', type: 'INCOMING' });
  });

  it('should correctly map a custom token transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-4',
      '2023-01-04T12:00:00.000Z',
      'ERC20',
      '8000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'usdc-token',
      'USDC',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-4',
      amount: '8000',
      tokenSymbol: 'USDC',
      tokenDecimals: 18,
      feeAmount: '0',
      type: 'OUTGOING',
    });
  });

  it('should correctly map an NFT transfer', () => {
    const transfer = createMockTransferEdge(
      'transfer-nft',
      '2023-01-05T12:00:00.000Z',
      'ERC721',
      '1',
      ANOTHER_ADDRESS,
      USER_ADDRESS,
      'nft-token',
      'NFT Collection',
      true,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'transfer-nft',
      amount: '1',
      tokenSymbol: 'NFT',
      tokenDecimals: 0,
      type: 'INCOMING',
      from: ANOTHER_ADDRESS,
      to: USER_ADDRESS,
      feeAmount: '0',
    });
  });

  it('should handle failed extrinsics', () => {
    const transfer = createMockTransferEdge(
      'transfer-7',
      '2023-01-07T12:00:00.000Z',
      'Native',
      '11000',
      USER_ADDRESS,
      ANOTHER_ADDRESS,
      'reef-token',
      'REEF',
      false,
    );

    const result = mapTransfersToUiTransfers([transfer], USER_ADDRESS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ success: false, status: 'Fail' });
  });

  it('should handle empty input', () => {
    const result = mapTransfersToUiTransfers([], USER_ADDRESS);
    expect(result).toEqual([]);
  });

  it('should handle undefined input', () => {
    expect(mapTransfersToUiTransfers([], 'some-address')).toEqual([]);
  });
});

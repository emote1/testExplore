import { describe, it, expect } from 'vitest';
import { mapTransfersToUiTransfers } from './transfer-mapper';
import type {
  TransfersFeeQueryQuery as TransfersQuery,
  Transfer,
  Account,
  VerifiedContract,
  TransferType,
} from '../types/graphql-generated';

// The third argument for extrinsics, which we are not testing here.


type TransferEdge = TransfersQuery['transfersConnection']['edges'][0];

const USER_ADDRESS = '5G1kG9y9Qtnk2WPSb1d1A2x3s4e5U6f7G8h9iJ0kL1m2n3o4';
const ANOTHER_ADDRESS = '5AnotherAddressForTestingPurpose';

const createMockAccount = (id: string): Partial<Account> => ({
  __typename: 'Account',
  id,
  evmAddress: `0xevm_${id}`,
});

const createMockVerifiedContract = (name: string, decimals = 18): Partial<VerifiedContract> => ({
  __typename: 'VerifiedContract',
  id: `contract_${name}`,
  name,
  contractData: { __typename: 'ContractData', decimals },
  type: 'other', // Using string literal as ContractType is a type alias
});

const createMockTransfer = (
  id: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  success: boolean,
  type: TransferType, // TransferType is a type alias for string literals
  tokenName: string,
  extrinsicHash?: string,
): Partial<Transfer> => {
  const isNft = type === 'ERC721' || type === 'ERC1155';
  return {
    __typename: 'Transfer',
    id,
    to: createMockAccount(toAddress) as Account,
    from: createMockAccount(fromAddress) as Account,
    amount,
    success,
    type,
    extrinsicHash: extrinsicHash || `0xhash-${id}`,
    timestamp: new Date().toISOString(),
    token: createMockVerifiedContract(tokenName, isNft ? 0 : 18) as VerifiedContract,
  };
};

const createMockTransferEdge = (transfer: Partial<Transfer>): TransferEdge => ({
  __typename: 'TransferEdge',
  node: transfer as Transfer,
});

describe('mapTransfersToUiTransfers', () => {
  it('should correctly map an incoming REEF transfer', () => {
    const transfer = createMockTransfer('t1', ANOTHER_ADDRESS, USER_ADDRESS, '5000', true, 'Native', 'REEF');
    const result = mapTransfersToUiTransfers([createMockTransferEdge(transfer)], USER_ADDRESS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'INCOMING', amount: '5000' });
  });

  it('should correctly map an outgoing REEF transfer', () => {
    const transfer = createMockTransfer('t2', USER_ADDRESS, ANOTHER_ADDRESS, '6000', true, 'Native', 'REEF');
    const result = mapTransfersToUiTransfers([createMockTransferEdge(transfer)], USER_ADDRESS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'OUTGOING', amount: '6000' });
  });

  it('should correctly map an NFT transfer', () => {
    const transfer = createMockTransfer('t3', USER_ADDRESS, ANOTHER_ADDRESS, '1', true, 'ERC1155', 'MyNFT');
    const result = mapTransfersToUiTransfers([createMockTransferEdge(transfer)], USER_ADDRESS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ isNft: true, amount: '1' });
  });

  it('should return an empty array if transfers are null or undefined', () => {
    expect(mapTransfersToUiTransfers(null, USER_ADDRESS)).toEqual([]);
    expect(mapTransfersToUiTransfers(undefined, USER_ADDRESS)).toEqual([]);
  });

  it('should handle multiple transfers correctly', () => {
    const transfers = [
      createMockTransferEdge(createMockTransfer('t5', ANOTHER_ADDRESS, USER_ADDRESS, '100', true, 'Native', 'REEF')),
      createMockTransferEdge(createMockTransfer('t6', USER_ADDRESS, ANOTHER_ADDRESS, '200', true, 'Native', 'REEF')),
    ];
    const result = mapTransfersToUiTransfers(transfers, USER_ADDRESS);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('INCOMING');
    expect(result[1].type).toBe('OUTGOING');
  });

  it('should handle failed transfers', () => {
    const transfer = createMockTransfer('t7', USER_ADDRESS, ANOTHER_ADDRESS, '100', false, 'Native', 'REEF');
    const result = mapTransfersToUiTransfers([createMockTransferEdge(transfer)], USER_ADDRESS);
    expect(result).toHaveLength(1);
    expect(result[0].success).toBe(false);
  });

  it('should map ERC20 token transfers correctly', () => {
    const transfer = createMockTransfer('t8', USER_ADDRESS, ANOTHER_ADDRESS, '9000', true, 'ERC20', 'MyToken');
    const result = mapTransfersToUiTransfers([createMockTransferEdge(transfer)], USER_ADDRESS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'OUTGOING',
      amount: '9000',
      token: { name: 'MyToken' },
      isNft: false,
    });
  });

  it('should handle empty input', () => {
    const result = mapTransfersToUiTransfers([], USER_ADDRESS);
    expect(result).toEqual([]);
  });
});

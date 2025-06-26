/// <reference types="vitest/globals" />
import { renderHook, waitFor, act } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { useTransactionDataWithBlocks } from './use-transaction-data-with-blocks';
import { PAGINATED_TRANSFERS_QUERY, EXTRINSICS_BY_IDS_QUERY } from '../data/transfers';
import type {
  TransfersQueryQueryVariables,
  Transfer,
  Account,
  Block,
  VerifiedContract,
  Contract,
  Extrinsic,
} from '../types/graphql-generated';

const MOCK_USER_ADDRESS = 'user-address';
const MOCK_FEE_HEX = '0x1b041e23123124';
const EXPECTED_FEE = BigInt(MOCK_FEE_HEX).toString();

const createMockBlock = (height: number): Block => ({
  __typename: 'Block',
  id: `block-${height}`,
  height,
  hash: `0xhash_block_${height}`,
  parentHash: `0xhash_block_${height - 1}`,
  timestamp: new Date().toISOString(),
  extrinsicRoot: '',
  stateRoot: '',
  events: [],
  extrinsics: [],
  author: 'author-id',
  finalized: true,
  accounts: [],
});

const createMockAccount = (id: string): Account => ({
  __typename: 'Account',
  id,
  evmAddress: `0xevm_${id}`,
  active: true,
  freeBalance: '0',
  lockedBalance: '0',
  availableBalance: '0',
  reservedBalance: '0',
  vestedBalance: '0',
  votingBalance: '0',
  timestamp: new Date().toISOString(),
  block: createMockBlock(1),
  contracts: [],
  evmNonce: 0,
  nonce: 0,
});

const createMockExtrinsic = (id: string, partialFeeHex: string): Extrinsic => ({
  __typename: 'Extrinsic',
  id,
  block: createMockBlock(1),
  index: 0,
  hash: `0xhash_extrinsic_${id}`,
  signer: createMockAccount('signer-account').id,
  section: 'testSection',
  method: 'testMethod',
  args: {},
  docs: 'Mock extrinsic documentation.',
  status: 'success',
  timestamp: new Date().toISOString(),
  type: 'signed',
  contracts: [],
  events: [],
  signedData: {
    __typename: 'SignedData',
    fee: {
      __typename: 'Fee',
      partialFee: partialFeeHex,
    },
  },
});

const createMockContract = (id: string): Contract => ({
  __typename: 'Contract',
  id,
  bytecode: '0x',
  bytecodeArguments: '',
  bytecodeContext: '',
  extrinsic: createMockExtrinsic('extrinsic-for-contract', MOCK_FEE_HEX),
  gasLimit: '0',
  timestamp: new Date().toISOString(),
  signer: createMockAccount('contract-signer'),
  storageLimit: '100000',
});

const createMockVerifiedContract = (id: string): VerifiedContract => ({
  __typename: 'VerifiedContract',
  id,
  name: 'REEF',
  contractData: { __typename: 'ContractData', decimals: 18 },
  args: null,
  compiledData: null,
  compilerVersion: '0.8.0',
  contract: createMockContract('contract-id'),
  source: '',
  license: null,
  target: '',
  optimization: false,
  runs: 0,
  timestamp: new Date().toISOString(),
});

const createMockTransfer = (id: string, extrinsicId: string): Transfer => ({
  __typename: 'Transfer',
  id,
  amount: '1000000000000000000',
  timestamp: new Date().toISOString(),
  success: true,
  type: 'Native',
  extrinsicId,
  extrinsicHash: `0xhash_${id}`,
  from: createMockAccount('from-address'),
  to: createMockAccount(MOCK_USER_ADDRESS),
  token: createMockVerifiedContract('reef-token-id'),
  blockHash: '0xblockhash',
  blockHeight: 123,
  eventIndex: 1,
  extrinsicIndex: 0,
  finalized: true,
});

describe('useTransactionDataWithBlocks', () => {
  it('should return loading state initially', async () => {
    const { result } = renderHook(
      () => useTransactionDataWithBlocks(MOCK_USER_ADDRESS, 10),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        ),
      },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it('should fetch transfers, then extrinsics, and update state correctly', async () => {
    const MOCK_TRANSFERS = [
      createMockTransfer('transfer-1', 'extrinsic-1'),
      createMockTransfer('transfer-2', 'extrinsic-2'),
    ];
    const MOCK_EXTRINSICS = [
      createMockExtrinsic('extrinsic-1', MOCK_FEE_HEX),
      createMockExtrinsic('extrinsic-2', MOCK_FEE_HEX),
    ];
    const variables: TransfersQueryQueryVariables = {
      first: 2,
      after: null,
      orderBy: ['timestamp_DESC'],
      where: {
        OR: [
          { from: { id_eq: MOCK_USER_ADDRESS } },
          { to: { id_eq: MOCK_USER_ADDRESS } },
        ],
      },
    };

    const mocks: MockedResponse[] = [
      {
        request: { query: PAGINATED_TRANSFERS_QUERY, variables },
        result: {
          data: {
            transfersConnection: {
              __typename: 'TransfersConnection',
              edges: MOCK_TRANSFERS.map((node) => ({
                __typename: 'TransferEdge',
                node,
              })),
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'cursor-end',
              },
              totalCount: MOCK_TRANSFERS.length,
            },
          },
        },
      },
      {
        request: {
          query: EXTRINSICS_BY_IDS_QUERY,
          variables: { ids: ['extrinsic-1', 'extrinsic-2'] },
        },
        result: { data: { extrinsics: MOCK_EXTRINSICS } },
      },
    ];

    const { result } = renderHook(
      () => useTransactionDataWithBlocks(MOCK_USER_ADDRESS, 2),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.transactions[0]?.fee.amount).toBe(EXPECTED_FEE);
    expect(result.current.transactions[1]?.fee.amount).toBe(EXPECTED_FEE);
  });

  it('should return an error when the query fails', async () => {
    const variables: TransfersQueryQueryVariables = {
      first: 1,
      after: null,
      orderBy: ['timestamp_DESC'],
      where: {
        OR: [
          { from: { id_eq: MOCK_USER_ADDRESS } },
          { to: { id_eq: MOCK_USER_ADDRESS } },
        ],
      },
    };
    const errorMock: MockedResponse[] = [
      {
        request: { query: PAGINATED_TRANSFERS_QUERY, variables },
        error: new Error('An error occurred'),
      },
    ];

    const { result } = renderHook(
      () => useTransactionDataWithBlocks(MOCK_USER_ADDRESS, 1),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={errorMock}>{children}</MockedProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
  });

  it('should append new transfers when fetchMore is called', async () => {
    const MOCK_TRANSFERS_PAGE_1 = [createMockTransfer('transfer-1', 'extrinsic-1')];
    const MOCK_TRANSFERS_PAGE_2 = [createMockTransfer('transfer-2', 'extrinsic-2')];
    
    const MOCK_EXTRINSIC_1 = createMockExtrinsic('extrinsic-1', MOCK_FEE_HEX);
    const MOCK_EXTRINSIC_2 = createMockExtrinsic('extrinsic-2', MOCK_FEE_HEX);

    const varsPage1: TransfersQueryQueryVariables = {
      first: 1,
      after: null,
      orderBy: ['timestamp_DESC'],
      where: { OR: [{ from: { id_eq: MOCK_USER_ADDRESS } }, { to: { id_eq: MOCK_USER_ADDRESS } }] },
    };
    const varsPage2: TransfersQueryQueryVariables = {
      first: 1,
      after: 'cursor-1',
      orderBy: ['timestamp_DESC'],
      where: { OR: [{ from: { id_eq: MOCK_USER_ADDRESS } }, { to: { id_eq: MOCK_USER_ADDRESS } }] },
    };

    const mocks: MockedResponse[] = [
      // 1. Initial transfers query
      {
        request: { query: PAGINATED_TRANSFERS_QUERY, variables: varsPage1 },
        result: {
          data: {
            transfersConnection: {
              __typename: 'TransfersConnection',
              edges: MOCK_TRANSFERS_PAGE_1.map((node) => ({ __typename: 'TransferEdge', node })),
              pageInfo: { __typename: 'PageInfo', hasNextPage: true, endCursor: 'cursor-1' },
              totalCount: 2,
            },
          },
        },
      },
      // 2. Initial extrinsics query for the first transfer
      {
        request: { query: EXTRINSICS_BY_IDS_QUERY, variables: { ids: ['extrinsic-1'] } },
        result: { data: { extrinsics: [MOCK_EXTRINSIC_1] } },
      },
      // 3. fetchMore transfers query
      {
        request: { query: PAGINATED_TRANSFERS_QUERY, variables: varsPage2 },
        result: {
          data: {
            transfersConnection: {
              __typename: 'TransfersConnection',
              edges: MOCK_TRANSFERS_PAGE_2.map((node) => ({ __typename: 'TransferEdge', node })),
              pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: 'cursor-2' },
              totalCount: 2,
            },
          },
        },
      },
      // 4. Extrinsics query after fetchMore, for ONLY the new transfer
      {
        request: { query: EXTRINSICS_BY_IDS_QUERY, variables: { ids: ['extrinsic-2'] } },
        result: { data: { extrinsics: [MOCK_EXTRINSIC_2] } },
      },
    ];

    const { result } = renderHook(
      () => useTransactionDataWithBlocks(MOCK_USER_ADDRESS, 1),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks} addTypename>
            {children}
          </MockedProvider>
        ),
      },
    );

    // Initial load assertions
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(result.current.transactions[0]?.fee.amount).toBe(EXPECTED_FEE);

    // Trigger fetchMore
    await act(async () => {
      result.current.fetchMore();
    });

    // fetchMore assertions
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    expect(result.current.transactions[0]?.fee.amount).toBe(EXPECTED_FEE);
    expect(result.current.transactions[1]?.fee.amount).toBe(EXPECTED_FEE);
    expect(result.current.hasNextPage).toBe(false);
  });
});

/// <reference types="vitest/globals" />
import { renderHook, waitFor, act } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { useTransactionDataWithBlocks } from './use-transaction-data-with-blocks';
import { PAGINATED_TRANSFERS_QUERY, FEE_EVENTS_QUERY } from '../data/transfers';
import { TransfersQueryQuery, FeeEventsQueryQuery } from '../types/graphql-generated';

const MOCK_ADDRESS = '5GREeQcGHt7na341Py6Y6Gr2gXhXb1a412j71jL1dbx4g45d';
const MOCK_LIMIT = 10;

// Helper to create mock for the main transfers query
const createTransfersMock = (
  variables: { after?: string | null; limit: number },
  response: { hasNextPage: boolean; endCursor: string; count: number; startId: number },
): MockedResponse<TransfersQueryQuery> => ({
  request: {
    query: PAGINATED_TRANSFERS_QUERY,
    variables: {
      first: variables.limit,
      after: variables.after || null,
      orderBy: ['timestamp_DESC' as const],
      where: {
        OR: [
          { from: { id_eq: MOCK_ADDRESS } },
          { to: { id_eq: MOCK_ADDRESS } },
        ],
      },
    },
  },
  result: {
    data: {
      transfersConnection: {
        __typename: 'TransfersConnection',
        totalCount: 100,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: response.hasNextPage,
          endCursor: response.endCursor,
        },
        edges: Array.from({ length: response.count }, (_, i) => ({
          __typename: 'TransferEdge',
          node: {
            __typename: 'Transfer',
            id: `transfer-${response.startId + i}`,
            amount: '1000000000000000000', // 1 REEF
            timestamp: new Date().toISOString(),
            success: true,
            type: 'Native',
            extrinsicHash: `0xhash${response.startId + i}`,
            from: {
              __typename: 'Account',
              id: '5FakeFromAddress',
            },
            to: {
              __typename: 'Account',
              id: MOCK_ADDRESS,
            },
            token: {
              __typename: 'VerifiedContract',
              id: 'reef-token',
              name: 'REEF',
              contractData: null,
            },
          },
        })),
      },
    },
  },
});

// Helper to create mock for the fee query
const createFeeMock = (extrinsicHashes: string[]): MockedResponse<FeeEventsQueryQuery> => ({
  request: {
    query: FEE_EVENTS_QUERY,
    variables: {
      orderBy: ['timestamp_DESC'],
      where: {
        section_eq: 'transactionpayment',
        method_eq: 'TransactionFeePaid',
        extrinsic: { hash_in: extrinsicHashes },
      },
    },
  },
  result: {
    data: {
      eventsConnection: {
        __typename: 'EventsConnection',
        edges: extrinsicHashes.map(hash => ({
          __typename: 'EventEdge',
          node: {
            __typename: 'Event',
            id: `${hash}-fee`,
            data: ['someSigner', '123450000000000000'], // Mock fee amount
            extrinsic: {
              __typename: 'Extrinsic',
              id: `extrinsic-${hash}`,
              hash,
            },
          },
        })),
      },
    },
  },
});

// Mocks for a successful initial load and fee fetch
const initialExtrinsicHashes = Array.from({ length: 10 }, (_, i) => `0xhash${i + 1}`);
const mocks: MockedResponse[] = [
  createTransfersMock({ limit: MOCK_LIMIT, after: null }, { hasNextPage: true, endCursor: '10', count: 10, startId: 1 }),
  createFeeMock(initialExtrinsicHashes),
];

// Mocks for a failed query
const errorMock: MockedResponse[] = [
  {
    request: mocks[0].request,
    error: new Error('An error occurred'),
  },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={mocks} addTypename={true}>
    {children}
  </MockedProvider>
);

const errorWrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={errorMock} addTypename={true}>
    {children}
  </MockedProvider>
);

// Mocks including an additional page of data for fetchMore tests
const secondPageExtrinsicHashes = Array.from({ length: 5 }, (_, i) => `0xhash${i + 11}`);
const fetchMoreMocks: MockedResponse[] = [
  ...mocks,
  createTransfersMock(
    { limit: MOCK_LIMIT, after: '10' },
    { hasNextPage: false, endCursor: '15', count: 5, startId: 11 },
  ),
  createFeeMock(secondPageExtrinsicHashes),
];

const fetchMoreWrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={fetchMoreMocks} addTypename={true}>
    {children}
  </MockedProvider>
);

describe('useTransactionDataWithBlocks', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => useTransactionDataWithBlocks(MOCK_ADDRESS, MOCK_LIMIT), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('should fetch transfers, then fees, and update state correctly', async () => {
    const { result } = renderHook(() => useTransactionDataWithBlocks(MOCK_ADDRESS, MOCK_LIMIT), { wrapper });

    // Initial state: loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the hook to finish loading transfers and their associated fees.
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.transactions.length).toBe(10);
      // Ensure the fee from the mock has been applied correctly.
      expect(result.current.transactions[0].feeAmount).toBe('123450000000000000');
    });

    // Final state check
    expect(result.current.transactions.length).toBe(10);
    expect(result.current.transactions[9].feeAmount).toBe('123450000000000000');
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalCount).toBe(100);
    expect(result.current.error).toBeUndefined();
  });

  it('should return an error when the query fails', async () => {
    const { result } = renderHook(() => useTransactionDataWithBlocks(MOCK_ADDRESS, MOCK_LIMIT), { wrapper: errorWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('An error occurred');
    expect(result.current.transactions.length).toBe(0);
  });

  it('should append new transfers when fetchMore is called', async () => {
    const { result } = renderHook(() => useTransactionDataWithBlocks(MOCK_ADDRESS, MOCK_LIMIT), {
      wrapper: fetchMoreWrapper,
    });

    // Wait for initial data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.transactions.length).toBe(10);
    });

    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.fetchMore();
    });

    await waitFor(() => {
      expect(result.current.transactions.length).toBe(15);
      // Wait until the fee for the last transaction of the new page is applied
      expect(result.current.transactions[14].feeAmount).toBe('123450000000000000');
    });
    expect(result.current.hasNextPage).toBe(false);
  });
});

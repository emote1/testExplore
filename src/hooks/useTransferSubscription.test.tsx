/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import React from 'react';
import { useTransferSubscription } from './useTransferSubscription';
import { TRANSFERS_POLLING_QUERY } from '../data/transfers';
import type { Transfer, TransfersPollingQueryQuery } from '../types/graphql-generated';

vi.mock('../data/transfer-mapper', () => ({
  mapTransfersToUiTransfers: vi.fn((edges: { node: Transfer }[]): any[] => {
    if (!edges) return [];
    return edges.map(({ node: transfer }, index) => ({
      id: transfer.id,
      hash: transfer.extrinsicHash || `0xhash${index}`,
      timestamp: new Date(transfer.timestamp).toISOString(),
      from: transfer.from.id,
      to: transfer.to.id,
      amount: transfer.amount.toString(),
      tokenSymbol: 'REEF',
      tokenDecimals: 18,
      success: transfer.success,
      status: transfer.success ? 'Success' : 'Fail',
      type: 'INCOMING',
      feeAmount: '100000000000000',
      feeTokenSymbol: 'REEF',
    }));
  }),
}));

const MOCK_ADDRESS = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

const createMockAccount = (id: string): any => ({
  __typename: 'Account',
  id,
  ...({} as any),
});

const createMockTransfer = (id: string, fromAddress: string, toAddress: string, customTimestamp?: string): Transfer => ({
  __typename: 'Transfer',
  id: `transfer-${id}`,
  amount: '1000000000000000000',
  timestamp: customTimestamp || '2023-06-20T10:00:00.000Z',
  success: true,
  type: 'Native',
  extrinsicHash: `0xhash-${id}`,
  from: createMockAccount(fromAddress),
  to: createMockAccount(toAddress),
  token: {
    __typename: 'VerifiedContract',
    id: 'reef-token',
    name: 'REEF',
    ...({} as any),
  },
  ...({} as any),
});

const createMockResponse = (
  transfers: Transfer[],
  address: string,
): MockedResponse<TransfersPollingQueryQuery> => ({
  request: {
    query: TRANSFERS_POLLING_QUERY,
    variables: {
      where: {
        OR: [
          { from: { id_eq: address } },
          { to: { id_eq: address } },
        ],
      },
      orderBy: ['timestamp_DESC'],
      offset: 0,
      limit: 10,
    },
  },
  result: {
    data: {
      transfers,
    },
  },
  newData: () => ({
    data: {
      transfers,
    },
  }),
});

interface WrapperProps {
  children: React.ReactNode;
}

const createWrapper = (mocks: readonly MockedResponse<any>[] = []): React.FC<WrapperProps> => {
  const TestWrapper = ({ children }: WrapperProps) => (
    <MockedProvider mocks={mocks} addTypename={true}>
      {children}
    </MockedProvider>
  );
  return TestWrapper;
};

describe('useTransferSubscription', () => {
  let mockOnNewTransfer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnNewTransfer = vi.fn();
    vi.clearAllMocks();
  });

  it('should not start polling when isEnabled is false', async () => {
    const mockTransfers = [createMockTransfer('1', MOCK_ADDRESS, 'some-other-address')];
    const mocks = [createMockResponse(mockTransfers, MOCK_ADDRESS)];

    renderHook(
      () => useTransferSubscription({
        address: MOCK_ADDRESS,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: false,
      }),
      { wrapper: createWrapper(mocks) },
    );

    await new Promise(res => setTimeout(res, 200));

    expect(mockOnNewTransfer).not.toHaveBeenCalled();
  });

  it('should detect new transfers when enabled', async () => {
    const initialTransfers = [
      createMockTransfer('1', MOCK_ADDRESS, 'some-other-address', '2023-06-20T09:00:00.000Z'),
    ];

    const mocks = [createMockResponse(initialTransfers, MOCK_ADDRESS)];

    renderHook(
      () => useTransferSubscription({
        address: MOCK_ADDRESS,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: true,
      }),
      { wrapper: createWrapper(mocks) },
    );

    await new Promise(res => setTimeout(res, 200));

    expect(mockOnNewTransfer).not.toHaveBeenCalled();
  });

  it('should not trigger duplicate notifications for same transfers', async () => {
    const mockTransfers = [
      createMockTransfer('1', MOCK_ADDRESS, 'some-other-address', '2023-06-20T09:00:00.000Z')
    ];
    
    const mocks = [createMockResponse(mockTransfers, MOCK_ADDRESS)];

    renderHook(
      () => useTransferSubscription({
        address: MOCK_ADDRESS,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: true,
      }),
      { wrapper: createWrapper(mocks) },
    );

    await new Promise(res => setTimeout(res, 200));
    
    expect(mockOnNewTransfer).not.toHaveBeenCalled();
  });

  it('should clear tracking when address changes', async () => {
    const firstAddressTransfers = [
      createMockTransfer('1', MOCK_ADDRESS, 'some-other-address', '2023-06-20T09:00:00.000Z')
    ];
    const secondAddressTransfers = [
      createMockTransfer('2', 'different-address', 'some-other', '2023-06-20T09:30:00.000Z')
    ];

    const mocks = [
      createMockResponse(firstAddressTransfers, MOCK_ADDRESS),
      createMockResponse(secondAddressTransfers, 'different-address'),
    ];

    const { rerender } = renderHook(
      ({ address }) => useTransferSubscription({
        address,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: true,
      }),
      { 
        wrapper: createWrapper(mocks),
        initialProps: { address: MOCK_ADDRESS }
      },
    );

    await new Promise(res => setTimeout(res, 100));
    expect(mockOnNewTransfer).not.toHaveBeenCalled(); // No notifications on first load

    rerender({ address: 'different-address' });

    await new Promise(res => setTimeout(res, 100));
    
    expect(mockOnNewTransfer).not.toHaveBeenCalled();
  });

  it('should handle query errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const errorMock: MockedResponse<TransfersPollingQueryQuery> = {
      request: {
        query: TRANSFERS_POLLING_QUERY,
        variables: {
          where: {
            OR: [
              { from: { id_eq: MOCK_ADDRESS } },
              { to: { id_eq: MOCK_ADDRESS } },
            ],
          },
          orderBy: ['timestamp_DESC'],
          offset: 0,
          limit: 10,
        },
      },
      error: new Error('Network error'),
    };

    renderHook(
      () => useTransferSubscription({
        address: MOCK_ADDRESS,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: true,
      }),
      { wrapper: createWrapper([errorMock]) },
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Subscription error:', expect.any(Error));
    });

    expect(mockOnNewTransfer).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should handle empty transfer data', async () => {
    const mocks = [createMockResponse([], MOCK_ADDRESS)];

    renderHook(
      () => useTransferSubscription({
        address: MOCK_ADDRESS,
        onNewTransfer: mockOnNewTransfer,
        isEnabled: true,
      }),
      { wrapper: createWrapper(mocks) },
    );

    await new Promise(res => setTimeout(res, 200));

    expect(mockOnNewTransfer).not.toHaveBeenCalled();
  });
});

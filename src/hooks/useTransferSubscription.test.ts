import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import React from 'react';
import { gql } from '@apollo/client';
import { useTransferSubscription } from './useTransferSubscription';
import type { Transaction } from '../types/transaction-types';

// Mock the mapper utility
vi.mock('../utils/transfer-mapper', () => ({
  mapTransferToTransaction: vi.fn((transfer: any, userAddress: string | null): Transaction => ({
    id: transfer.id,
    hash: transfer.extrinsicHash || '',
    timestamp: new Date(transfer.timestamp).toISOString(),
    from: transfer.from?.id || '',
    to: transfer.to?.id || '',
    amount: transfer.amount,
    tokenSymbol: 'REEF',
    tokenDecimals: 18,
    success: transfer.success,
    status: transfer.success ? 'Success' : 'Fail',
    extrinsicHash: transfer.extrinsicHash || null,
    extrinsicId: null,
    // Используем userAddress для определения типа транзакции
    type: userAddress && transfer.from?.id === userAddress ? 'OUTGOING' : 'INCOMING',
    feeAmount: '0',
    feeTokenSymbol: 'REEF',
    signedData: undefined,
    raw: transfer
  }))
}));

const TRANSFERS_QUERY = gql`
  query RecentTransfers($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]) {
    transfers(where: $where, orderBy: $orderBy, limit: 5) {
      id
      amount
      timestamp
      success
      extrinsicHash
      from {
        id
      }
      to {
        id
      }
      token {
        id
        name
        contractData
      }
    }
  }
`;

interface TransfersData {
  transfers: Array<{
    id: string;
    amount: string;
    timestamp: string;
    success: boolean;
    extrinsicHash: string | null;
    from: { id: string } | null;
    to: { id: string } | null;
    token: {
      id: string;
      name: string;
      contractData: any | null;
    } | null;
  }>;
}

const mockTransferData: TransfersData = {
  transfers: [
    {
      id: 'transfer-1',
      amount: '1000000000000000000',
      timestamp: '2023-12-01T10:00:00Z',
      success: true,
      extrinsicHash: '0xabc123',
      from: { id: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' },
      to: { id: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty' },
      token: {
        id: 'reef-token',
        name: 'REEF',
        contractData: null
      }
    },
    {
      id: 'transfer-2',
      amount: '2000000000000000000',
      timestamp: '2023-12-01T11:00:00Z',
      success: false,
      extrinsicHash: '0xdef456',
      from: { id: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty' },
      to: { id: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' },
      token: {
        id: 'reef-token',
        name: 'REEF',
        contractData: null
      }
    }
  ]
};

interface WrapperProps {
  children: React.ReactNode;
}

function createWrapper(mocks: any[] = []): React.ComponentType<WrapperProps> {
  function TestWrapper({ children }: WrapperProps): React.ReactElement {
    return React.createElement(MockedProvider, { mocks, addTypename: false }, children);
  }
  return TestWrapper;
}

describe('useTransferSubscription', () => {
  const mockOnNewTransaction = vi.fn();
  const userAddress: string = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch when disabled', () => {
    renderHook(
      () => useTransferSubscription({
        nativeAddress: userAddress,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: false
      }),
      { wrapper: createWrapper() }
    );

    expect(mockOnNewTransaction).not.toHaveBeenCalled();
  });

  it('should not fetch when no address provided', () => {
    renderHook(
      () => useTransferSubscription({
        nativeAddress: null,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { wrapper: createWrapper() }
    );

    expect(mockOnNewTransaction).not.toHaveBeenCalled();
  });

  it('should process relevant transfers for user address', async () => {
    const mocks = [
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: userAddress } },
                { to: { id_eq: userAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        result: {
          data: mockTransferData
        }
      }
    ];

    renderHook(
      () => useTransferSubscription({
        nativeAddress: userAddress,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { wrapper: createWrapper(mocks) }
    );

    await waitFor(() => {
      expect(mockOnNewTransaction).toHaveBeenCalledTimes(2);
    });

    expect(mockOnNewTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'transfer-1',
        from: userAddress
      })
    );

    expect(mockOnNewTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'transfer-2',
        to: userAddress
      })
    );
  });

  it('should not add duplicate transfers', async () => {
    const mocks = [
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: userAddress } },
                { to: { id_eq: userAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        result: {
          data: mockTransferData
        }
      }
    ];

    const { rerender } = renderHook(
      () => useTransferSubscription({
        nativeAddress: userAddress,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { wrapper: createWrapper(mocks) }
    );

    await waitFor(() => {
      expect(mockOnNewTransaction).toHaveBeenCalledTimes(2);
    });

    mockOnNewTransaction.mockClear();
    rerender();

    await waitFor(() => {
      expect(mockOnNewTransaction).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('should clear tracking when address changes', async () => {
    const newAddress: string = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
    
    const mocks = [
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: userAddress } },
                { to: { id_eq: userAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        result: {
          data: mockTransferData
        }
      },
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: newAddress } },
                { to: { id_eq: newAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        result: {
          data: mockTransferData
        }
      }
    ];

    const { rerender } = renderHook(
      ({ address }: { address: string | null }) => useTransferSubscription({
        nativeAddress: address,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { 
        wrapper: createWrapper(mocks),
        initialProps: { address: userAddress }
      }
    );

    await waitFor(() => {
      expect(mockOnNewTransaction).toHaveBeenCalledTimes(2);
    });

    mockOnNewTransaction.mockClear();
    rerender({ address: newAddress });

    await waitFor(() => {
      expect(mockOnNewTransaction).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle query errors gracefully', async () => {
    // Установим шпиона до создания хука
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mocks = [
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: userAddress } },
                { to: { id_eq: userAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        error: new Error('Network error')
      }
    ];

    // Рендерим хук с ошибкой
    renderHook(
      () => useTransferSubscription({
        nativeAddress: userAddress,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { wrapper: createWrapper(mocks) }
    );

    // Ждем, пока ошибка не будет обработана
    await waitFor(() => {
      // Проверяем, что console.error был вызван хотя бы один раз
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // Проверяем, что обработчик новых транзакций не был вызван
    expect(mockOnNewTransaction).not.toHaveBeenCalled();
    
    // Восстанавливаем оригинальную функцию console.error
    consoleErrorSpy.mockRestore();
  });

  it('should handle empty transfer data', async () => {
    const mocks = [
      {
        request: {
          query: TRANSFERS_QUERY,
          variables: {
            where: {
              OR: [
                { from: { id_eq: userAddress } },
                { to: { id_eq: userAddress } }
              ]
            },
            orderBy: ['timestamp_DESC']
          }
        },
        result: {
          data: { transfers: [] }
        }
      }
    ];

    renderHook(
      () => useTransferSubscription({
        nativeAddress: userAddress,
        onNewTransaction: mockOnNewTransaction,
        isEnabled: true
      }),
      { wrapper: createWrapper(mocks) }
    );

    await waitFor(() => {
      expect(mockOnNewTransaction).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });
});

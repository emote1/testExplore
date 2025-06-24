export const MOCK_DATA = {
  transfersConnection: {
    edges: [
      {
        cursor: 'c34a2f5544d4e9a16f2a5c365c1f7a7b',
        node: {
          id: '0x123-1',
          timestamp: new Date().toISOString(),
          amount: '1000000000000000000', // 1 REEF
          success: true,
          extrinsicHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          extrinsicId: '12345-1',
          feeAmount: '10000000000000000',
          blockHeight: 12345,
          token: {
            id: 'reef-token',
            name: 'Reef',
            contractData: JSON.stringify({ symbol: 'REEF', decimals: 18 }),
          },
          from: { 
            id: '5G1kGk2Gv5sT4b5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3',
            evmAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          to: { 
            id: '5F7h47fy44E9An1b5e1b3a4j5D6g7H8i9J0k1L2m3N4o5P6q',
            evmAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        },
      },
    ],
    pageInfo: {
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: 'c34a2f5544d4e9a16f2a5c365c1f7a7b',
      endCursor: 'c34a2f5544d4e9a16f2a5c365c1f7a7b',
    },
    totalCount: 100,
  },
};

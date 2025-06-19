import { describe, it, expect } from 'vitest';
import { parseTokenData, mapTransferToTransaction } from './transfer-mapper';

describe('parseTokenData', () => {
  it('should return default values when contractData is undefined', () => {
    const result = parseTokenData();
    expect(result).toEqual({
      symbol: 'REEF',
      decimals: 18
    });
  });

  it('should return default values when contractData is empty string', () => {
    const result = parseTokenData('');
    expect(result).toEqual({
      symbol: 'REEF',
      decimals: 18
    });
  });

  it('should parse valid JSON contractData correctly', () => {
    const contractData = JSON.stringify({
      symbol: 'USDC',
      decimals: 6
    });
    
    const result = parseTokenData(contractData);
    expect(result).toEqual({
      symbol: 'USDC',
      decimals: 6
    });
  });

  it('should handle partial contractData with only symbol', () => {
    const contractData = JSON.stringify({
      symbol: 'ETH'
    });
    
    const result = parseTokenData(contractData);
    expect(result).toEqual({
      symbol: 'ETH',
      decimals: 18 // default
    });
  });

  it('should handle partial contractData with only decimals', () => {
    const contractData = JSON.stringify({
      decimals: 8
    });
    
    const result = parseTokenData(contractData);
    expect(result).toEqual({
      symbol: 'REEF', // default
      decimals: 8
    });
  });

  it('should handle string decimals value', () => {
    const contractData = JSON.stringify({
      symbol: 'BTC',
      decimals: '8'
    });
    
    const result = parseTokenData(contractData);
    expect(result).toEqual({
      symbol: 'BTC',
      decimals: 8
    });
  });

  it('should return defaults for invalid JSON', () => {
    const result = parseTokenData('invalid json');
    expect(result).toEqual({
      symbol: 'REEF',
      decimals: 18
    });
  });

  it('should handle null/undefined values in JSON', () => {
    const contractData = JSON.stringify({
      symbol: null,
      decimals: undefined
    });
    
    const result = parseTokenData(contractData);
    expect(result).toEqual({
      symbol: 'REEF',
      decimals: 18
    });
  });
});

describe('mapTransferToTransaction', () => {
  const baseTransfer = {
    id: 'transfer-123',
    amount: '1000000000000000000',
    timestamp: '2023-12-01T10:00:00Z',
    success: true,
    extrinsicHash: '0xabc123',
    from: { id: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' },
    to: { id: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty' }
  };

  it('should map basic transfer correctly', () => {
    const result = mapTransferToTransaction(baseTransfer);
    
    expect(result).toMatchObject({
      id: 'transfer-123',
      hash: '0xabc123',
      amount: '1000000000000000000',
      from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      success: true,
      status: 'Success',
      tokenSymbol: 'REEF',
      tokenDecimals: 18,
      feeAmount: '0',
      feeTokenSymbol: 'REEF'
    });
  });

  it('should handle failed transfer', () => {
    const failedTransfer = { ...baseTransfer, success: false };
    
    const result = mapTransferToTransaction(failedTransfer);
    
    expect(result.success).toBe(false);
    expect(result.status).toBe('Fail');
  });

  it('should handle transfer with custom token', () => {
    const transferWithToken = {
      ...baseTransfer,
      token: {
        id: 'token-456',
        name: 'USD Coin',
        contractData: JSON.stringify({
          symbol: 'USDC',
          decimals: 6
        })
      }
    };
    
    const result = mapTransferToTransaction(transferWithToken);
    
    expect(result.tokenSymbol).toBe('USDC');
    expect(result.tokenDecimals).toBe(6);
  });

  it('should handle missing optional fields', () => {
    const minimalTransfer = {
      id: 'transfer-456',
      amount: '500000000000000000',
      timestamp: '2023-12-01T11:00:00Z',
      success: true
    };
    
    const result = mapTransferToTransaction(minimalTransfer);
    
    expect(result).toMatchObject({
      id: 'transfer-456',
      hash: '',
      from: '',
      to: '',
      extrinsicHash: null,
      extrinsicId: null
    });
  });

  it('should include raw transfer data', () => {
    const result = mapTransferToTransaction(baseTransfer);
    
    expect(result.raw).toEqual(baseTransfer);
  });

  it('should format timestamp correctly', () => {
    const transferWithTimestamp = {
      ...baseTransfer,
      timestamp: '2023-12-01T15:30:45.123Z'
    };
    
    const result = mapTransferToTransaction(transferWithTimestamp);
    
    expect(result.timestamp).toBe(new Date('2023-12-01T15:30:45.123Z').toISOString());
  });

  it('should pass userAddress to determineDisplayType', () => {
    const userAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    
    const result = mapTransferToTransaction(baseTransfer, userAddress);
    
    // The type should be determined based on the userAddress
    expect(result.type).toBeDefined();
    expect(typeof result.type).toBe('string');
  });
});

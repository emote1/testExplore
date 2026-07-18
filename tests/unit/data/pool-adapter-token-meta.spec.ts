import { describe, it, expect } from 'vitest';
import { tokenMetaForRow, transferRowToSovraTx, type RawTransferRow } from '../../../src/data/pool-adapter';

// Row shapes mirror the Hasura response of POOL_TRANSFERS_QUERY (aliased
// verifiedContract: verified_contract { name contract_data }).
const baseRow: RawTransferRow = {
  id: '0011659158-abcde-000',
  amount: '2900000000000000000000',
  timestamp: '2025-01-31T10:00:00+00:00',
  success: true,
  type: 'ERC20',
  reefswapAction: 'Swap',
  fromId: '0x8de305c88ec150c707517858e3ea67fedd5180ff',
  toId: '0xpair',
};

describe('data/pool-adapter tokenMetaForRow', () => {
  it('prefers verified_contract symbol + decimals over the generic fallback', () => {
    const row: RawTransferRow = {
      ...baseRow,
      tokenId: '0x12c8e2cfbd068869bbcc4c551e8c4a39c2b8f24b',
      verifiedContract: { name: 'SOON', contract_data: { symbol: 'SOON', decimals: 18, tokenName: 'Soon Coin' } },
    };
    expect(tokenMetaForRow(row)).toEqual({ symbol: 'SOON', decimals: 18 });
  });

  it('uses contract name when contract_data lacks a symbol', () => {
    const row: RawTransferRow = {
      ...baseRow,
      tokenId: '0x7a11d5038490877a76188aa396ed03d5b59f621a',
      verifiedContract: { name: 'HYDRA', contract_data: { decimals: 8 } },
    };
    expect(tokenMetaForRow(row)).toEqual({ symbol: 'HYDRA', decimals: 8 });
  });

  it('renames generic ReefSwap LP tokens to a distinguishable LP label', () => {
    const row: RawTransferRow = {
      ...baseRow,
      tokenId: '0x282c124d1d56c904b28513e5f1fed8272a184683',
      verifiedContract: { name: 'Reefswap V2', contract_data: { symbol: 'REEF-V2', decimals: 18 } },
    };
    expect(tokenMetaForRow(row).symbol).toBe('LP 0x282c1…4683');
  });

  it('falls back to the known-id map without verified_contract', () => {
    const row: RawTransferRow = { ...baseRow, tokenId: '0xdeadbeef00000000000000000000000000000000' };
    expect(tokenMetaForRow(row)).toEqual({ symbol: 'TOKEN', decimals: 18 });
  });

  it('threads the resolved symbol and decimals into SovraTx', () => {
    const row: RawTransferRow = {
      ...baseRow,
      tokenId: '0x12c8e2cfbd068869bbcc4c551e8c4a39c2b8f24b',
      verifiedContract: { name: 'SOON', contract_data: { symbol: 'SOON', decimals: 18 } },
    };
    const tx = transferRowToSovraTx(row, ['5ED6qi', '0x8de305c88ec150c707517858e3ea67fedd5180ff'], { reefUsd: 0, pricesById: {} }, Date.now());
    expect(tx.coin).toBe('SOON');
    expect(tx.amount).toBeCloseTo(2900, 6);
    expect(tx.channel).toBe('swap');
  });
});

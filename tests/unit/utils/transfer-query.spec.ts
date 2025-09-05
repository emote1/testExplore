import { describe, it, expect } from 'vitest';
import { buildTransferWhereFilter } from '../../../src/utils/transfer-query';

describe('utils/transfer-query', () => {
  it('returns undefined when no addresses provided', () => {
    expect(buildTransferWhereFilter({})).toBeUndefined();
  });

  it('builds OR filter for native address only', () => {
    const where = buildTransferWhereFilter({ resolvedAddress: '5Fabc' });
    expect(where).toEqual({
      OR: [
        { from: { id_eq: '5Fabc' } },
        { to: { id_eq: '5Fabc' } },
      ],
    });
  });

  it('builds OR filter for EVM address only', () => {
    const where = buildTransferWhereFilter({ resolvedEvmAddress: '0xabc' });
    expect(where).toEqual({
      OR: [
        { fromEvmAddress_eq: '0xabc' },
        { toEvmAddress_eq: '0xabc' },
      ],
    });
  });

  it('builds combined OR filter for both addresses', () => {
    const where = buildTransferWhereFilter({ resolvedAddress: '5Fabc', resolvedEvmAddress: '0xabc' });
    expect(where).toEqual({
      OR: [
        { from: { id_eq: '5Fabc' } },
        { to: { id_eq: '5Fabc' } },
        { fromEvmAddress_eq: '0xabc' },
        { toEvmAddress_eq: '0xabc' },
      ],
    });
  });
});

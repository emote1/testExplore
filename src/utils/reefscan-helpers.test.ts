import { generateReefscanUrl } from './reefscan-helpers';
import type { UiTransfer } from '../data/transfer-mapper';

describe('generateReefscanUrl', () => {
  const mockTransaction = (data: Partial<UiTransfer>): UiTransfer => {
    return {
      id: 'default-id',
      extrinsicHash: '0x' + '0'.repeat(64),
      timestamp: new Date().toISOString(),
      from: 'fromAddress',
      to: 'toAddress',
      amount: '100',
      token: { id: 'reef', name: 'REEF', decimals: 18 },
      success: true,
      type: 'INCOMING',
      fee: { amount: '1', token: { id: 'reef', name: 'REEF', decimals: 18 } },
      ...data,
    } as UiTransfer;
  };

  it('should generate URL for a valid 3-part decimal ID', () => {
    const tx = mockTransaction({ id: '123456-1-2' });
    expect(generateReefscanUrl(tx)).toBe('https://reefscan.com/transfer/123456/1/2');
  });

  it('should generate URL for a valid 2-part decimal ID', () => {
    const tx = mockTransaction({ id: '123456-1' });
    expect(generateReefscanUrl(tx)).toBe('https://reefscan.com/transfer/123456/1/1');
  });

  it('should generate URL for a valid 3-part ID with a hex component', () => {
    const tx = mockTransaction({ id: '0012580519-cf30d-000001' });
    expect(generateReefscanUrl(tx)).toBe('https://reefscan.com/transfer/0012580519/1/000001');
  });

  it('should handle commas in the ID parts', () => {
    const tx = mockTransaction({ id: '1,234,567-1-2' });
    expect(generateReefscanUrl(tx)).toBe('https://reefscan.com/transfer/1234567/1/2');
  });

  it('should prefer a valid ID over a valid hash', () => {
    const tx = mockTransaction({ id: '123-1-1', extrinsicHash: '0x' + 'e'.repeat(64) });
    expect(generateReefscanUrl(tx)).toBe('https://reefscan.com/transfer/123/1/1');
  });

  it('should fall back to a valid hash if the ID is invalid', () => {
    const hash = '0x' + 'f'.repeat(64);
    const tx = mockTransaction({ id: 'invalid-id', extrinsicHash: hash });
    expect(generateReefscanUrl(tx)).toBe(`https://reefscan.com/extrinsic/${hash}`);
  });

  it('should fall back to a valid hash if the ID is missing', () => {
    const hash = '0x' + 'd'.repeat(64);
    const tx = mockTransaction({ id: '', extrinsicHash: hash });
    expect(generateReefscanUrl(tx)).toBe(`https://reefscan.com/extrinsic/${hash}`);
  });

  it('should generate URL from a hash that needs a 0x prefix', () => {
    const hash = 'b'.repeat(64);
    const tx = mockTransaction({ id: 'invalid', extrinsicHash: hash });
    expect(generateReefscanUrl(tx)).toBe(`https://reefscan.com/extrinsic/0x${hash}`);
  });

  it('should return # if ID is invalid and hash is invalid', () => {
    const tx = mockTransaction({ id: 'invalid', extrinsicHash: 'invalid-hash' });
    expect(generateReefscanUrl(tx)).toBe('#');
  });

  it('should return # if ID is invalid and hash is too short', () => {
    const tx = mockTransaction({ id: 'invalid', extrinsicHash: '0x123' });
    expect(generateReefscanUrl(tx)).toBe('#');
  });

  it('should return # if no ID or hash is provided', () => {
    const tx = mockTransaction({ id: '', extrinsicHash: '' });
    expect(generateReefscanUrl(tx)).toBe('#');
  });
});
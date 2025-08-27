import { describe, it, expect, beforeAll } from 'vitest';
import { toHex, decodeAbiString, applyErc1155Template } from '../../../src/utils/abi';

// Ensure TextDecoder exists in Node environments where not global
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextDecoder as NodeTextDecoder } from 'util';

beforeAll(() => {
  if (!(globalThis as any).TextDecoder && NodeTextDecoder) {
    (globalThis as any).TextDecoder = NodeTextDecoder as unknown as typeof TextDecoder;
  }
});

describe('utils/abi', () => {
  it('toHex pads to 32 bytes (64 hex chars) by default', () => {
    const h = toHex(0x2an as unknown as bigint); // 0x2a = 42
    expect(h.endsWith('2a')).toBe(true);
    expect(h.length).toBe(64);
  });

  it('toHex supports custom padding bytes', () => {
    const h = toHex(0x2an as unknown as bigint, 4); // 4 bytes => 8 hex chars
    expect(h).toBe('0000002a');
  });

  it('decodeAbiString decodes ABI-encoded string return', () => {
    // Encode single string("hello") as ABI return data:
    // [0..31]: offset (0x20)
    // [32..63]: length (0x05)
    // [64..]: data ('hello' + zero padding to 32 bytes)
    const offset = '0000000000000000000000000000000000000000000000000000000000000020';
    const length = '0000000000000000000000000000000000000000000000000000000000000005';
    const data = '68656c6c6f' + '0'.repeat(64 - '68656c6c6f'.length); // pad to 32 bytes
    const hex = '0x' + offset + length + data;
    expect(decodeAbiString(hex)).toBe('hello');
  });

  it('applyErc1155Template replaces {id} and {ID} with 32-byte hex (lowercase)', () => {
    const tpl = 'ipfs://bafy/{id}.json';
    const out = applyErc1155Template(tpl, 1);
    expect(out).toMatch(/^ipfs:\/\/bafy\/[0-9a-f]{64}\.json$/);
    expect(out.includes('0000000000000000000000000000000000000000000000000000000000000001')).toBe(true);

    const tpl2 = 'ipfs://bafy/{ID}';
    const out2 = applyErc1155Template(tpl2, '2');
    expect(out2.endsWith('0000000000000000000000000000000000000000000000000000000000000002')).toBe(true);
  });
});

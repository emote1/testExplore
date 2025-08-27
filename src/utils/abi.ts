/**
 * ABI helpers
 */
export function toHex(value: bigint, padBytes = 32): string {
  const hex = value.toString(16);
  return hex.length >= padBytes * 2 ? hex : '0'.repeat(padBytes * 2 - hex.length) + hex;
}

export function decodeAbiString(hex: string): string | null {
  try {
    if (!hex || hex.length < 2) return null;
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 64 * 2) return null;
    const offset = parseInt(clean.slice(0, 64), 16);
    const lenPos = offset * 2;
    const length = parseInt(clean.slice(lenPos, lenPos + 64), 16);
    const dataPos = lenPos + 64;
    const dataHex = clean.slice(dataPos, dataPos + length * 2);
    const bytes = new Uint8Array(dataHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function applyErc1155Template(uri: string, nftId: string | number): string {
  const id = BigInt(typeof nftId === 'string' ? nftId : Number(nftId));
  const hexId = toHex(id).toLowerCase();
  return uri.replace('{id}', hexId).replace('{ID}', hexId);
}

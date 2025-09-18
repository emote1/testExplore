import { graphql } from '@/gql';
import { getString } from '@/utils/object';

export const VERIFIED_CONTRACTS_BY_IDS_QUERY = graphql(`
  query VerifiedContractsByIds($ids: [String!], $first: Int!) {
    verifiedContracts(
      where: { id_in: $ids }
      limit: $first
    ) {
      id
      contractData
    }
  }
`);

export interface TokenIconMap { [id: string]: string | undefined }

export function extractIconFromContractData(cd: unknown): string | undefined {
  let obj: unknown = cd;
  try {
    if (typeof cd === 'string') obj = JSON.parse(cd);
  } catch {
    obj = cd;
  }
  const url =
    getString(obj, ['icon'])
    || getString(obj, ['iconUrl'])
    || getString(obj, ['iconURL'])
    || getString(obj, ['icon_url'])
    || getString(obj, ['logo'])
    || getString(obj, ['logoURI'])
    || getString(obj, ['logoUrl'])
    || getString(obj, ['logoURL'])
    || getString(obj, ['logo_url'])
    || getString(obj, ['image'])
    || getString(obj, ['imageUrl'])
    || getString(obj, ['imageURL'])
    || getString(obj, ['image_url'])
    || getString(obj, ['metadata', 'image'])
    || getString(obj, ['metadata', 'imageUrl'])
    || getString(obj, ['metadata', 'imageURL'])
    || getString(obj, ['metadata', 'logoURI'])
    || getString(obj, ['metadata', 'logoUrl'])
    || getString(obj, ['metadata', 'logoURL'])
    || getString(obj, ['metadata', 'icon'])
    || getString(obj, ['metadata', 'iconUrl'])
    || getString(obj, ['metadata', 'iconURL'])
    || undefined;
  // Return the raw URL (ipfs:// preferred). The UI will expand into gateway candidates.
  return url || undefined;
}

export function buildIconMap(rows: Array<{ id?: unknown; contractData?: unknown }>): TokenIconMap {
  const m: TokenIconMap = {};
  for (const r of rows) {
    const id = typeof r?.id === 'string' ? r.id : undefined;
    if (!id) continue;
    const icon = extractIconFromContractData(r.contractData);
    if (icon) m[id] = icon;
  }
  return m;
}

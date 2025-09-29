import { graphql } from '@/gql';

// Fetch verified contracts by exact names list
export const VERIFIED_CONTRACTS_BY_NAME_QUERY = graphql(`
  query VerifiedContractsByName($names: [String!], $needle: String) {
    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {
      id
      name
    }
  }
`);

import { graphql } from '@/gql';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

// Fetch verified contracts by exact names list
const VERIFIED_CONTRACTS_BY_NAME_SUBSQUID_QUERY = graphql(`
  query VerifiedContractsByName($names: [String!], $needle: String) {
    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {
      id
      name
    }
  }
`);

const VERIFIED_CONTRACTS_BY_NAME_HASURA_QUERY = parse(`
  query VerifiedContractsByNameHasura($names: [String!], $needle: String) {
    verifiedContracts: verified_contract(where: { _or: [{ name: { _in: $names } }, { name: { _ilike: $needle } }] }) {
      id
      name
    }
  }
`);

export const VERIFIED_CONTRACTS_BY_NAME_QUERY = isHasuraExplorerMode
  ? VERIFIED_CONTRACTS_BY_NAME_HASURA_QUERY
  : VERIFIED_CONTRACTS_BY_NAME_SUBSQUID_QUERY;

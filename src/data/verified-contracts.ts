import { parse } from 'graphql';

const VERIFIED_CONTRACTS_BY_NAME_HASURA_QUERY = parse(`
  query VerifiedContractsByNameHasura($names: [String!], $needle: String) {
    verifiedContracts: verified_contract(where: { _or: [{ name: { _in: $names } }, { name: { _ilike: $needle } }] }) {
      id
      name
    }
  }
`);

export const VERIFIED_CONTRACTS_BY_NAME_QUERY = VERIFIED_CONTRACTS_BY_NAME_HASURA_QUERY;

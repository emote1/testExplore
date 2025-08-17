import { graphql } from '@/gql';

/**
 * Query to get account by EVM address
 * This is used to resolve EVM addresses to their corresponding native addresses
 */
export const GET_ACCOUNT_BY_EVM_QUERY = graphql(`
  query GetAccountByEvm($evmAddress: String!) {
    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {
      id
      evmAddress
    }
  }
`);

/**
 * Query to get account by native (Substrate) address
 * This can be used to validate native addresses
 */
export const GET_ACCOUNT_BY_NATIVE_QUERY = graphql(`
  query GetAccountByNative($nativeAddress: String!) {
    accounts(where: { id_eq: $nativeAddress }, limit: 1) {
      id
      evmAddress
    }
  }
`);

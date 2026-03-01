import { graphql } from '@/gql';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

/**
 * Query to get account by EVM address
 * This is used to resolve EVM addresses to their corresponding native addresses
 */
const GET_ACCOUNT_BY_EVM_SUBSQUID_QUERY = graphql(`
  query GetAccountByEvm($evmAddress: String!) {
    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {
      id
      evmAddress
    }
  }
`);

const GET_ACCOUNT_BY_EVM_HASURA_QUERY = parse(`
  query GetAccountByEvmHasura($evmAddress: String!) {
    accounts: account(where: { evm_address: { _eq: $evmAddress } }, limit: 1) {
      id
      evmAddress: evm_address
    }
  }
`);

export const GET_ACCOUNT_BY_EVM_QUERY = isHasuraExplorerMode
  ? GET_ACCOUNT_BY_EVM_HASURA_QUERY
  : GET_ACCOUNT_BY_EVM_SUBSQUID_QUERY;

/**
 * Query to get account by native (Substrate) address
 * This can be used to validate native addresses
 */
const GET_ACCOUNT_BY_NATIVE_SUBSQUID_QUERY = graphql(`
  query GetAccountByNative($nativeAddress: String!) {
    accounts(where: { id_eq: $nativeAddress }, limit: 1) {
      id
      evmAddress
    }
  }
`);

const GET_ACCOUNT_BY_NATIVE_HASURA_QUERY = parse(`
  query GetAccountByNativeHasura($nativeAddress: String!) {
    accounts: account(where: { id: { _eq: $nativeAddress } }, limit: 1) {
      id
      evmAddress: evm_address
    }
  }
`);

export const GET_ACCOUNT_BY_NATIVE_QUERY = isHasuraExplorerMode
  ? GET_ACCOUNT_BY_NATIVE_HASURA_QUERY
  : GET_ACCOUNT_BY_NATIVE_SUBSQUID_QUERY;

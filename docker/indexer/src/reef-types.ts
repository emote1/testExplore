// Official Reef Chain type definitions, extracted verbatim from
// @reef-chain/evm-provider@4.0.5 (reef-api/defaultOptions — Acala-derived).
// Kept as a static module so the indexer image needs no extra dependency.
//
// Why this exists: the previous hand-rolled REEF_TYPE_OVERRIDES defined
// CurrencyId as 'u32'. It is really a 1+n byte enum, so any block containing a
// currencies.* event (every ReefSwap swap with a REEF leg emits
// currencies.Transferred) mis-aligned the SCALE stream and the whole
// system.events vector failed to decode — the indexer then skipped the block
// silently. These definitions decode every era of the chain, verified against
// blocks 741684 / 1311605 / 9971077 / 15261713 / 16223997.

export const REEF_TYPES = {
  // Reef's runtime predates the [u8;4] module-error layout: ExtrinsicFailed
  // carries DispatchError.Module{index:u8, error:u8}. Without this override the
  // default (4-byte error) misaligns the whole system.events vector for any
  // block containing a failed extrinsic.
  DispatchErrorModule: { index: 'u8', error: 'u8' },
  CallOf: 'Call',
  DispatchTime: { _enum: { At: 'BlockNumber', After: 'BlockNumber' } },
  ScheduleTaskIndex: 'u32',
  DelayedOrigin: { delay: 'BlockNumber', origin: 'PalletsOrigin' },
  AuthorityOrigin: 'DelayedOrigin',
  StorageValue: 'Vec<u8>',
  GraduallyUpdate: { key: 'StorageKey', targetValue: 'StorageValue', perBlock: 'StorageValue' },
  StorageKeyBytes: 'Vec<u8>',
  StorageValueBytes: 'Vec<u8>',
  RpcDataProviderId: 'Text',
  DataProviderId: 'u8',
  TimestampedValue: { value: 'OracleValue', timestamp: 'Moment' },
  TimestampedValueOf: 'TimestampedValue',
  OrderedSet: 'Vec<AccountId>',
  OrmlAccountData: { free: 'Balance', reserved: 'Balance', frozen: 'Balance' },
  OrmlBalanceLock: { amount: 'Balance', id: 'LockIdentifier' },
  AuctionInfo: {
    bid: 'Option<(AccountId, Balance)>',
    start: 'BlockNumber',
    end: 'Option<BlockNumber>',
  },
  DelayedDispatchTime: { _enum: { At: 'BlockNumber', After: 'BlockNumber' } },
  DispatchId: 'u32',
  Price: 'FixedU128',
  OrmlVestingSchedule: {
    start: 'BlockNumber',
    period: 'BlockNumber',
    periodCount: 'u32',
    perPeriod: 'Compact<Balance>',
  },
  VestingScheduleOf: 'OrmlVestingSchedule',
  OrmlCurrencyId: 'u8',
  PoolInfo: { totalShares: 'Share', rewards: 'BTreeMap<OrmlCurrencyId, (Balance, Balance)>' },
  CompactBalance: 'Compact<Balance>',
  PoolInfoV0: {
    totalShares: 'Compact<Share>',
    totalRewards: 'CompactBalance',
    totalWithdrawnRewards: 'CompactBalance',
  },
  Share: 'u128',
  OracleValue: 'Price',
  PalletBalanceOf: 'Balance',
  EstimateResourcesResponse: { gas: 'u256', storage: 'i32', weightFee: 'u256' },
  EvmAccountInfo: {
    nonce: 'Index',
    contractInfo: 'Option<EvmContractInfo>',
    developerDeposit: 'Option<Balance>',
  },
  CodeInfo: { codeSize: 'u32', refCount: 'u32' },
  EvmContractInfo: { codeHash: 'H256', maintainer: 'H160', deployed: 'bool' },
  EvmAddress: 'H160',
  CallRequest: {
    from: 'Option<H160>',
    to: 'Option<H160>',
    gasLimit: 'Option<u32>',
    storageLimit: 'Option<u32>',
    value: 'Option<U128>',
    data: 'Option<Bytes>',
  },
  CommitmentOf: { duration: 'LockDuration', amount: 'BalanceOf', candidate: 'AccountId' },
  Era: { index: 'u32', start: 'BlockNumber' },
  LockDuration: { _enum: ['OneMonth', 'OneYear', 'TenYears'] },
  PoolId: {
    _enum: { Loans: 'CurrencyId', DexIncentive: 'CurrencyId', DexSaving: 'CurrencyId', Homa: 'Null' },
  },
  Amount: 'i128',
  AmountOf: 'Amount',
  AuctionId: 'u32',
  AuctionIdOf: 'AuctionId',
  TokenSymbol: { _enum: { REEF: 0, RUSD: 1 } },
  CurrencyId: {
    _enum: { Token: 'TokenSymbol', DEXShare: '(TokenSymbol, TokenSymbol)', ERC20: 'EvmAddress' },
  },
  CurrencyIdOf: 'CurrencyId',
  AuthoritysOriginId: { _enum: ['Root'] },
  TradingPair: '(CurrencyId,  CurrencyId)',
  OracleKey: 'CurrencyId',
  AsOriginId: 'AuthoritysOriginId',
  ExchangeRate: 'FixedU128',
  Rate: 'FixedU128',
  Ratio: 'FixedU128',
  Keys: 'SessionKeys4',
  PalletsOrigin: {
    _enum: {
      System: 'SystemOrigin',
      Timestamp: 'Null',
      RandomnessCollectiveFlip: 'Null',
      Balances: 'Null',
      Accounts: 'Null',
      Currencies: 'Null',
      Tokens: 'Null',
      Vesting: 'Null',
      AcalaTreasury: 'Null',
      Utility: 'Null',
      Multisig: 'Null',
      Recovery: 'Null',
      Proxy: 'Null',
      Scheduler: 'Null',
      Indices: 'Null',
      GraduallyUpdate: 'Null',
      Authorship: 'Null',
      Babe: 'Null',
      Grandpa: 'Null',
      Staking: 'Null',
      Session: 'Null',
      Historical: 'Null',
      GeneralCouncil: 'CollectiveOrigin',
      GeneralCouncilMembership: 'Null',
      HonzonCouncil: 'CollectiveOrigin',
      HonzonCouncilMembership: 'Null',
      HomaCouncil: 'CollectiveOrigin',
      HomaCouncilMembership: 'Null',
      TechnicalCommittee: 'CollectiveOrigin',
      TechnicalCommitteeMembership: 'Null',
      Authority: 'DelayedOrigin',
      ElectionsPhragmen: 'Null',
      AcalaOracle: 'Null',
      BandOracle: 'Null',
      OperatorMembershipAcala: 'Null',
      OperatorMembershipBand: 'Null',
      Auction: 'Null',
      Rewards: 'Null',
      OrmlNFT: 'Null',
      Prices: 'Null',
      Dex: 'Null',
      AuctionManager: 'Null',
      Loans: 'Null',
      Honzon: 'Null',
      CdpTreasury: 'Null',
      CdpEngine: 'Null',
      EmergencyShutdown: 'Null',
      Homa: 'Null',
      NomineesElection: 'Null',
      StakingPool: 'Null',
      PolkadotBridge: 'Null',
      Incentives: 'Null',
      AirDrop: 'Null',
      NFT: 'Null',
      RenVmBridge: 'Null',
      Contracts: 'Null',
      EVM: 'Null',
      Sudo: 'Null',
      TransactionPayment: 'Null',
    },
  },
};

export const REEF_TYPES_ALIAS = {
  evm: { AccountInfo: 'EvmAccountInfo', ContractInfo: 'EvmContractInfo' },
  tokens: { AccountData: 'OrmlAccountData', BalanceLock: 'OrmlBalanceLock' },
};

export const REEF_SIGNED_EXTENSIONS = {
  SetEvmOrigin: { extrinsic: {}, payload: {} },
};

/** Spread into ApiPromise.create({ provider, ...REEF_API_OPTIONS }). */
export const REEF_API_OPTIONS = {
  types: REEF_TYPES,
  typesAlias: REEF_TYPES_ALIAS,
  signedExtensions: REEF_SIGNED_EXTENSIONS,
};

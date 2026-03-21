create table if not exists validator_profile (
  address text primary key,
  display_name text null,
  has_identity boolean not null default false,
  identity_raw jsonb null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_validator_profile_updated_at
  on validator_profile (updated_at desc);

create table if not exists chain_stats_snapshot (
  id bigserial primary key,
  block_height bigint not null,
  block_hash text null,
  era integer null,
  timestamp timestamptz not null,
  total_issuance numeric(78, 0) not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_chain_stats_snapshot_block_height
  on chain_stats_snapshot (block_height);

create index if not exists idx_chain_stats_snapshot_timestamp
  on chain_stats_snapshot (timestamp desc);

create index if not exists idx_chain_stats_snapshot_era
  on chain_stats_snapshot (era desc);

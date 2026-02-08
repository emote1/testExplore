# ICP Canister Setup

## Identity

- **Name:** `mainnet`
- **Principal:** `davhc-f3tkm-u6efh-twjfp-inot4-vmfbw-ggutt-dv3bt-3qrle-e6fnv-sae`
- **Internet Identity (NNS):** `yhpos-ptkjd-3zzis-pdoik-dvqfg-44a2c-fsbu4-uxbxe-djrk4-diwgw-iqe`

## Canisters

### Wallet (cycles wallet)
- **ID:** `rrtyy-uaaaa-aaaam-aftaa-cai`
- **Balance:** ~300B cycles
- **Controllers:** dfx `mainnet` principal, II principal
- **Purpose:** Хранит циклы, оплачивает деплои, отправляет циклы другим канистрам

### reef_metrics_onchain (application)
- **ID:** `ndhxz-raaaa-aaaag-avdoa-cai`
- **Balance:** ~308B cycles
- **Controllers:** dfx `mainnet` principal, `iy46i-qmw5w-rekft-irzxz-qtg3w-exghw-ywunj-cx2w3-sw2k5-woqz6-mae`
- **Purpose:** Отдаёт JSON данные для графиков (active wallets, new wallets inflow)
- **Active URLs:**
  - `https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/active-wallets-daily.json`
  - `https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/new-wallets-inflow.json`
- **Deprecated URLs (still in canister, not used by frontend):**
  - `https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/extrinsics-daily.json`

## Useful Commands

```bash
# Switch to mainnet identity
dfx identity use mainnet

# Suppress plaintext warning
export DFX_WARNING=-mainnet_plaintext_identity

# Check canister status
dfx canister --network ic status ndhxz-raaaa-aaaag-avdoa-cai
dfx canister --network ic status rrtyy-uaaaa-aaaam-aftaa-cai

# Check principal
dfx identity get-principal

# Send cycles from wallet to canister
dfx wallet --network ic send ndhxz-raaaa-aaaag-avdoa-cai 10000000000

# Add controller
dfx canister --network ic update-settings <CANISTER_ID> --add-controller <PRINCIPAL>

# Deploy canister (from icp-onchain folder)
dfx deploy --network ic reef_metrics_onchain
```

## .env Variables (used in frontend)

```
VITE_ICP_ACTIVE_WALLETS_DAILY_URL=https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/active-wallets-daily.json
VITE_ICP_NEW_WALLETS_INFLOW_URL=https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/new-wallets-inflow.json
```

## TODO

- [ ] Убрать `extrinsics` из Rust канистры (`lib.rs` + `.did`) и переделоить.
  Сейчас cron передаёт `extrinsics: 0` в snapshot.
  Endpoint `/extrinsics-daily.json` остаётся в канистре, но не используется фронтендом.
  **Циклы не тратятся** — endpoint просто хранит статический JSON в памяти,
  циклы расходуются только на idle и на входящие запросы (query calls бесплатны).

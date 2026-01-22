use base64::{engine::general_purpose, Engine as _};
use candid::{CandidType, Deserialize, Principal};
use ic_certified_map::{labeled, labeled_hash, AsHashTree, Hash, RbTree};
use ic_cdk::api::management_canister::http_request as ic_http;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext,
};
use ic_cdk::api::{data_certificate, set_certified_data, time};
use ic_cdk::spawn;
use ic_cdk_timers::set_timer_interval;
use serde::Serialize;
use serde_cbor::ser::Serializer;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::cell::RefCell;
use std::time::Duration;
use time::{format_description::well_known::Rfc3339, Duration as TimeDuration, OffsetDateTime};

const DEFAULT_SOURCE_URL: &str = "https://squid.subsquid.io/reef-explorer/graphql";
const DEFAULT_DAYS: usize = 30;
const MAX_PAGES: usize = 100;
const HTTP_CYCLES: u128 = 50_000_000_000;
const CERTIFIED_PATHS: [&str; 4] = [
    "/",
    "/active-wallets-daily.json",
    "/extrinsics-daily.json",
    "/new-wallets-inflow.json",
];
const CERT_LABEL: &[u8] = b"http_assets";
const TRANSFERS_PAGE_QUERY: &str = r#"
  query TransfersPage($from: DateTime!, $to: DateTime!, $after: String) {
    transfersConnection(
      where: { timestamp_gte: $from, timestamp_lt: $to }
      orderBy: timestamp_ASC
      first: 200
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          from { id }
          to { id }
        }
      }
    }
  }
"#;

const EXTRINSICS_COUNT_QUERY: &str = r#"
  query ExtrinsicsCount($from: DateTime!, $to: DateTime!) {
    extrinsicsConnection(
      where: { timestamp_gte: $from, timestamp_lt: $to }
      orderBy: timestamp_ASC
    ) {
      totalCount
    }
  }
"#;

fn default_payload() -> String {
    json!({ "days": DEFAULT_DAYS, "series": [] }).to_string()
}

fn default_extrinsics_payload() -> String {
    json!({ "days": DEFAULT_DAYS, "series": [] }).to_string()
}

fn default_inflow_payload() -> String {
    json!({ "asOf": null, "minRaw": "0", "entries": [] }).to_string()
}

#[derive(Clone, CandidType, Deserialize, Serialize)]
struct DailyPoint {
    ts: String,
    active: u64,
    #[serde(rename = "new")]
    new_wallets: u64,
}

#[derive(Clone, CandidType, Deserialize, Serialize)]
struct DailyExtrinsicsPoint {
    ts: String,
    extrinsics: u64,
}

#[derive(Clone, CandidType, Deserialize)]
struct DailySnapshotInput {
    ts: String,
    active: u64,
    new_wallets: u64,
    extrinsics: u64,
}

#[derive(Clone, CandidType, Deserialize)]
struct State {
    owner: Principal,
    source_url: String,
    payload: String,
    extrinsics_payload: String,
    inflow_payload: String,
    last_updated: Option<u64>,
    series: Vec<DailyPoint>,
    extrinsics_series: Vec<DailyExtrinsicsPoint>,
    prev_active_wallets: Vec<String>,
    refresh_enabled: bool,
}

impl State {
    fn new(owner: Principal) -> Self {
        Self {
            owner,
            source_url: DEFAULT_SOURCE_URL.to_string(),
            payload: default_payload(),
            extrinsics_payload: default_extrinsics_payload(),
            inflow_payload: default_inflow_payload(),
            last_updated: None,
            series: Vec::new(),
            extrinsics_series: Vec::new(),
            prev_active_wallets: Vec::new(),
            refresh_enabled: true,
        }
    }
}

#[derive(Clone, CandidType, Deserialize)]
struct StateV1 {
    owner: Principal,
    source_url: String,
    payload: String,
    last_updated: Option<u64>,
}

#[derive(Clone, CandidType, Deserialize)]
struct StateV2 {
    owner: Principal,
    source_url: String,
    payload: String,
    last_updated: Option<u64>,
    series: Vec<DailyPoint>,
}

#[derive(Clone, CandidType, Deserialize)]
struct StateV3 {
    owner: Principal,
    source_url: String,
    payload: String,
    last_updated: Option<u64>,
    series: Vec<DailyPoint>,
    prev_active_wallets: Vec<String>,
}

#[derive(Clone, CandidType, Deserialize)]
struct StateV4 {
    owner: Principal,
    source_url: String,
    payload: String,
    extrinsics_payload: String,
    last_updated: Option<u64>,
    series: Vec<DailyPoint>,
    extrinsics_series: Vec<DailyExtrinsicsPoint>,
    prev_active_wallets: Vec<String>,
}

#[derive(Clone, CandidType, Deserialize)]
struct StateV5 {
    owner: Principal,
    source_url: String,
    payload: String,
    extrinsics_payload: String,
    last_updated: Option<u64>,
    series: Vec<DailyPoint>,
    extrinsics_series: Vec<DailyExtrinsicsPoint>,
    prev_active_wallets: Vec<String>,
    refresh_enabled: bool,
}

impl From<StateV1> for State {
    fn from(state: StateV1) -> Self {
        Self {
            owner: state.owner,
            source_url: state.source_url,
            payload: state.payload,
            extrinsics_payload: default_extrinsics_payload(),
            inflow_payload: default_inflow_payload(),
            last_updated: state.last_updated,
            series: Vec::new(),
            extrinsics_series: Vec::new(),
            prev_active_wallets: Vec::new(),
            refresh_enabled: true,
        }
    }
}

impl From<StateV2> for State {
    fn from(state: StateV2) -> Self {
        Self {
            owner: state.owner,
            source_url: state.source_url,
            payload: state.payload,
            extrinsics_payload: default_extrinsics_payload(),
            inflow_payload: default_inflow_payload(),
            last_updated: state.last_updated,
            series: state.series,
            extrinsics_series: Vec::new(),
            prev_active_wallets: Vec::new(),
            refresh_enabled: true,
        }
    }
}

impl From<StateV3> for State {
    fn from(state: StateV3) -> Self {
        Self {
            owner: state.owner,
            source_url: state.source_url,
            payload: state.payload,
            extrinsics_payload: default_extrinsics_payload(),
            inflow_payload: default_inflow_payload(),
            last_updated: state.last_updated,
            series: state.series,
            extrinsics_series: Vec::new(),
            prev_active_wallets: state.prev_active_wallets,
            refresh_enabled: true,
        }
    }
}

impl From<StateV4> for State {
    fn from(state: StateV4) -> Self {
        Self {
            owner: state.owner,
            source_url: state.source_url,
            payload: state.payload,
            extrinsics_payload: state.extrinsics_payload,
            inflow_payload: default_inflow_payload(),
            last_updated: state.last_updated,
            series: state.series,
            extrinsics_series: state.extrinsics_series,
            prev_active_wallets: state.prev_active_wallets,
            refresh_enabled: true,
        }
    }
}

impl From<StateV5> for State {
    fn from(state: StateV5) -> Self {
        Self {
            owner: state.owner,
            source_url: state.source_url,
            payload: state.payload,
            extrinsics_payload: state.extrinsics_payload,
            inflow_payload: default_inflow_payload(),
            last_updated: state.last_updated,
            series: state.series,
            extrinsics_series: state.extrinsics_series,
            prev_active_wallets: state.prev_active_wallets,
            refresh_enabled: state.refresh_enabled,
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::new(Principal::anonymous()));
    static CERT_TREE: RefCell<RbTree<String, Hash>> = RefCell::new(RbTree::new());
}

#[derive(CandidType, Deserialize)]
struct CanisterHttpRequest {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(CandidType, Deserialize)]
struct CanisterHttpResponse {
    status_code: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(CandidType, Deserialize)]
struct Status {
    source_url: String,
    last_updated: Option<u64>,
    payload_bytes: u64,
    refresh_enabled: bool,
}

#[ic_cdk::init]
fn init() {
    let owner = ic_cdk::caller();
    STATE.with(|state| {
        *state.borrow_mut() = State::new(owner);
    });

    sync_certified_data();
    init_timers();
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    let restored = ic_cdk::storage::stable_restore::<(State,)>().ok();
    if let Some((state,)) = restored {
        STATE.with(|s| *s.borrow_mut() = state);
    } else if let Ok((legacy,)) = ic_cdk::storage::stable_restore::<(StateV5,)>() {
        STATE.with(|s| *s.borrow_mut() = State::from(legacy));
    } else if let Ok((legacy,)) = ic_cdk::storage::stable_restore::<(StateV4,)>() {
        STATE.with(|s| *s.borrow_mut() = State::from(legacy));
    } else if let Ok((legacy,)) = ic_cdk::storage::stable_restore::<(StateV3,)>() {
        STATE.with(|s| *s.borrow_mut() = State::from(legacy));
    } else if let Ok((legacy,)) = ic_cdk::storage::stable_restore::<(StateV2,)>() {
        STATE.with(|s| *s.borrow_mut() = State::from(legacy));
    } else if let Ok((legacy,)) = ic_cdk::storage::stable_restore::<(StateV1,)>() {
        STATE.with(|s| *s.borrow_mut() = State::from(legacy));
    } else {
        let owner = ic_cdk::caller();
        STATE.with(|state| *state.borrow_mut() = State::new(owner));
    }

    sync_certified_data();
    init_timers();
}

#[ic_cdk::pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let _ = ic_cdk::storage::stable_save((state.borrow().clone(),));
    });
}

fn init_timers() {
    set_timer_interval(Duration::from_secs(24 * 60 * 60), || {
        spawn(async {
            let _ = refresh_internal().await;
        });
    });
}

fn assert_owner() -> Result<(), String> {
    let caller = ic_cdk::caller();
    let owner = STATE.with(|state| state.borrow().owner);
    if caller == owner {
        Ok(())
    } else {
        Err("unauthorized".to_string())
    }
}

async fn refresh_internal() -> Result<String, String> {
    let (graphql_url, refresh_enabled, payload) = STATE.with(|state| {
        let state = state.borrow();
        (
            state.source_url.clone(),
            state.refresh_enabled,
            state.payload.clone(),
        )
    });
    if !refresh_enabled {
        return Ok(payload);
    }
    let now = current_time()?;
    let last_start = now - TimeDuration::hours(24);
    let to_iso = now
        .format(&Rfc3339)
        .map_err(|_| "failed to format to timestamp".to_string())?;
    let last_iso = last_start
        .format(&Rfc3339)
        .map_err(|_| "failed to format last timestamp".to_string())?;

    let active_last = fetch_active_wallets_set(&graphql_url, &last_iso, &to_iso).await?;
    let extrinsics_last = fetch_extrinsics_count(&graphql_url, &last_iso, &to_iso).await?;
    let day_label = now.date().to_string();
    let point = DailyPoint {
        ts: day_label.clone(),
        active: active_last.len() as u64,
        new_wallets: 0,
    };
    let extrinsics_point = DailyExtrinsicsPoint {
        ts: day_label,
        extrinsics: extrinsics_last,
    };

    let (payload, extrinsics_payload, inflow_payload) = STATE.with(|state| {
        let mut state = state.borrow_mut();
        let new_wallets = if state.prev_active_wallets.is_empty() {
            0
        } else {
            let prev_set: HashSet<String> = state.prev_active_wallets.iter().cloned().collect();
            active_last.difference(&prev_set).count() as u64
        };
        state.prev_active_wallets = active_last.iter().cloned().collect();

        let mut point = point;
        point.new_wallets = new_wallets;
        upsert_daily_point(&mut state.series, point);
        upsert_extrinsics_point(&mut state.extrinsics_series, extrinsics_point);
        state.payload = build_payload(&state.series);
        state.extrinsics_payload = build_extrinsics_payload(&state.extrinsics_series);
        state.last_updated = Some(time());
        (
            state.payload.clone(),
            state.extrinsics_payload.clone(),
            state.inflow_payload.clone(),
        )
    });

    update_certified_data(&payload, &extrinsics_payload, &inflow_payload);

    Ok(payload)
}

#[ic_cdk::query]
fn get_active_wallets_daily() -> String {
    STATE.with(|state| state.borrow().payload.clone())
}

#[ic_cdk::query]
fn get_extrinsics_daily() -> String {
    STATE.with(|state| state.borrow().extrinsics_payload.clone())
}

#[ic_cdk::query]
fn get_new_wallets_inflow() -> String {
    STATE.with(|state| state.borrow().inflow_payload.clone())
}

#[ic_cdk::query]
fn get_status() -> Status {
    STATE.with(|state| {
        let state = state.borrow();
        Status {
            source_url: state.source_url.clone(),
            last_updated: state.last_updated,
            payload_bytes: state.payload.len() as u64,
            refresh_enabled: state.refresh_enabled,
        }
    })
}

#[ic_cdk::query]
fn get_owner() -> Principal {
    STATE.with(|state| state.borrow().owner)
}

#[ic_cdk::update]
fn set_owner(new_owner: Principal) {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    STATE.with(|state| {
        state.borrow_mut().owner = new_owner;
    });
}

#[ic_cdk::update]
fn set_source_url(url: String) {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    STATE.with(|state| {
        state.borrow_mut().source_url = url;
    });
}

#[ic_cdk::update]
fn set_refresh_enabled(enabled: bool) {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    STATE.with(|state| {
        state.borrow_mut().refresh_enabled = enabled;
    });
}

#[ic_cdk::update]
fn ingest_daily_snapshot(snapshot: DailySnapshotInput) -> String {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    let point = DailyPoint {
        ts: snapshot.ts.clone(),
        active: snapshot.active,
        new_wallets: snapshot.new_wallets,
    };
    let extrinsics_point = DailyExtrinsicsPoint {
        ts: snapshot.ts,
        extrinsics: snapshot.extrinsics,
    };

    let (payload, extrinsics_payload, inflow_payload, updated) = STATE.with(|state| {
        let mut state = state.borrow_mut();
        let same_point = state
            .series
            .iter()
            .any(|entry| entry.ts == point.ts && entry.active == point.active && entry.new_wallets == point.new_wallets);
        let same_ext = state
            .extrinsics_series
            .iter()
            .any(|entry| entry.ts == extrinsics_point.ts && entry.extrinsics == extrinsics_point.extrinsics);
        if same_point && same_ext {
            return (
                state.payload.clone(),
                state.extrinsics_payload.clone(),
                state.inflow_payload.clone(),
                false,
            );
        }
        upsert_daily_point(&mut state.series, point);
        upsert_extrinsics_point(&mut state.extrinsics_series, extrinsics_point);
        state.payload = build_payload(&state.series);
        state.extrinsics_payload = build_extrinsics_payload(&state.extrinsics_series);
        state.last_updated = Some(time());
        state.prev_active_wallets.clear();
        (
            state.payload.clone(),
            state.extrinsics_payload.clone(),
            state.inflow_payload.clone(),
            true,
        )
    });

    if updated {
        update_certified_data(&payload, &extrinsics_payload, &inflow_payload);
    }

    payload
}

#[ic_cdk::update]
fn ingest_new_wallets_inflow(payload: String) -> String {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    let (active_payload, extrinsics_payload, inflow_payload, updated) = STATE.with(|state| {
        let mut state = state.borrow_mut();
        if state.inflow_payload == payload {
            return (
                state.payload.clone(),
                state.extrinsics_payload.clone(),
                state.inflow_payload.clone(),
                false,
            );
        }
        state.inflow_payload = payload;
        state.last_updated = Some(time());
        (
            state.payload.clone(),
            state.extrinsics_payload.clone(),
            state.inflow_payload.clone(),
            true,
        )
    });

    if updated {
        update_certified_data(&active_payload, &extrinsics_payload, &inflow_payload);
    }

    inflow_payload
}

#[ic_cdk::update]
async fn refresh_now() -> String {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    refresh_internal().await.unwrap_or_else(|err| ic_cdk::trap(&err))
}

#[ic_cdk::query]
fn http_request(req: CanisterHttpRequest) -> CanisterHttpResponse {
    let path = normalize_path(&req.url);
    if !CERTIFIED_PATHS.contains(&path.as_str()) {
        return CanisterHttpResponse {
            status_code: 404,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: b"Not found".to_vec(),
        };
    }

    let payload = STATE.with(|state| {
        let state = state.borrow();
        match path.as_str() {
            "/extrinsics-daily.json" => state.extrinsics_payload.clone(),
            "/new-wallets-inflow.json" => state.inflow_payload.clone(),
            _ => state.payload.clone(),
        }
    });
    let mut headers = vec![
        ("Content-Type".to_string(), "application/json".to_string()),
        ("Cache-Control".to_string(), "public, max-age=60".to_string()),
    ];
    if let Some(cert_header) = build_certificate_header(&path) {
        headers.push(("IC-Certificate".to_string(), cert_header));
    }
    CanisterHttpResponse {
        status_code: 200,
        headers,
        body: payload.into_bytes(),
    }
}

#[ic_cdk::query]
fn transform(args: TransformArgs) -> HttpResponse {
    let mut response = args.response;
    response.headers.clear();
    response
}

fn normalize_path(url: &str) -> String {
    let mut path = url.split('?').next().unwrap_or("/");
    if let Some(scheme_idx) = path.find("://") {
        let remainder = &path[scheme_idx + 3..];
        if let Some(path_idx) = remainder.find('/') {
            path = &remainder[path_idx..];
        } else {
            path = "/";
        }
    }
    if path.is_empty() {
        "/".to_string()
    } else {
        path.to_string()
    }
}

fn sync_certified_data() {
    let (payload, extrinsics_payload, inflow_payload) = STATE.with(|state| {
        let state = state.borrow();
        (
            state.payload.clone(),
            state.extrinsics_payload.clone(),
            state.inflow_payload.clone(),
        )
    });
    update_certified_data(&payload, &extrinsics_payload, &inflow_payload);
}

fn update_certified_data(payload: &str, extrinsics_payload: &str, inflow_payload: &str) {
    let hash = sha256_hash(payload.as_bytes());
    let extrinsics_hash = sha256_hash(extrinsics_payload.as_bytes());
    let inflow_hash = sha256_hash(inflow_payload.as_bytes());
    CERT_TREE.with(|tree| {
        let mut tree = tree.borrow_mut();
        for path in CERTIFIED_PATHS {
            let path_hash = if path == "/extrinsics-daily.json" {
                extrinsics_hash
            } else if path == "/new-wallets-inflow.json" {
                inflow_hash
            } else {
                hash
            };
            tree.insert(path.to_string(), path_hash);
        }
        let root_hash = tree.root_hash();
        let labeled_hash = labeled_hash(CERT_LABEL, &root_hash);
        set_certified_data(&labeled_hash);
    });
}

fn sha256_hash(bytes: &[u8]) -> Hash {
    let digest = Sha256::digest(bytes);
    let mut hash = [0u8; 32];
    hash.copy_from_slice(digest.as_ref());
    hash
}

fn build_certificate_header(path: &str) -> Option<String> {
    let certificate = data_certificate()?;
    let tree_bytes = CERT_TREE.with(|tree| {
        let tree = tree.borrow();
        let witness = tree.witness(path.as_bytes());
        let labeled_tree = labeled(CERT_LABEL, witness);
        let mut serializer = Serializer::new(Vec::new());
        serializer.self_describe().ok()?;
        labeled_tree.serialize(&mut serializer).ok()?;
        Some(serializer.into_inner())
    })?;

    let cert_b64 = general_purpose::STANDARD.encode(certificate);
    let tree_b64 = general_purpose::STANDARD.encode(tree_bytes);
    Some(format!("certificate=:{cert_b64}:, tree=:{tree_b64}:"))
}

fn current_time() -> Result<OffsetDateTime, String> {
    let nanos = time();
    let secs = (nanos / 1_000_000_000) as i64;
    let sub_nanos = (nanos % 1_000_000_000) as u32;
    OffsetDateTime::from_unix_timestamp(secs)
        .map_err(|_| "invalid timestamp".to_string())?
        .replace_nanosecond(sub_nanos)
        .map_err(|_| "invalid timestamp nanos".to_string())
}

fn upsert_daily_point(series: &mut Vec<DailyPoint>, point: DailyPoint) {
    series.retain(|entry| entry.ts != point.ts);
    series.push(point);
    series.sort_by(|a, b| a.ts.cmp(&b.ts));
    if series.len() > DEFAULT_DAYS {
        let excess = series.len() - DEFAULT_DAYS;
        series.drain(0..excess);
    }
}

fn upsert_extrinsics_point(series: &mut Vec<DailyExtrinsicsPoint>, point: DailyExtrinsicsPoint) {
    series.retain(|entry| entry.ts != point.ts);
    series.push(point);
    series.sort_by(|a, b| a.ts.cmp(&b.ts));
    if series.len() > DEFAULT_DAYS {
        let excess = series.len() - DEFAULT_DAYS;
        series.drain(0..excess);
    }
}

fn build_payload(series: &[DailyPoint]) -> String {
    json!({ "days": DEFAULT_DAYS, "series": series }).to_string()
}

fn build_extrinsics_payload(series: &[DailyExtrinsicsPoint]) -> String {
    json!({ "days": DEFAULT_DAYS, "series": series }).to_string()
}

async fn fetch_extrinsics_count(
    graphql_url: &str,
    from_iso: &str,
    to_iso: &str,
) -> Result<u64, String> {
    let body = json!({
        "query": EXTRINSICS_COUNT_QUERY,
        "variables": {
            "from": from_iso,
            "to": to_iso,
        }
    });
    let body_bytes = serde_json::to_vec(&body)
        .map_err(|err| format!("failed to serialize graphql request: {err}"))?;

    let request = CanisterHttpRequestArgument {
        url: graphql_url.to_string(),
        method: HttpMethod::POST,
        headers: vec![
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "reef-metrics-onchain".to_string(),
            },
            HttpHeader {
                name: "Accept".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
        ],
        body: Some(body_bytes),
        max_response_bytes: Some(1_000_000),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
    };

    let (response,): (HttpResponse,) = ic_http::http_request(request, HTTP_CYCLES)
        .await
        .map_err(|(_, msg)| format!("http_request failed: {msg}"))?;

    if response.status != 200u16 {
        return Err(format!("upstream status {}", response.status));
    }

    let response_json: Value = serde_json::from_slice(&response.body)
        .map_err(|err| format!("failed to parse graphql response: {err}"))?;

    if let Some(errors) = response_json.get("errors") {
        return Err(format!("graphql error: {errors}"));
    }

    let total = response_json
        .get("data")
        .and_then(|data| data.get("extrinsicsConnection"))
        .and_then(|conn| conn.get("totalCount"))
        .and_then(|count| count.as_u64())
        .ok_or_else(|| "missing extrinsics totalCount".to_string())?;

    Ok(total)
}

async fn fetch_active_wallets_set(
    graphql_url: &str,
    from_iso: &str,
    to_iso: &str,
) -> Result<HashSet<String>, String> {
    let mut after: Option<String> = None;
    let mut page = 0usize;
    let mut active_wallets: HashSet<String> = HashSet::new();

    loop {
        page += 1;
        if page > MAX_PAGES {
            return Err(format!("exceeded max pages ({MAX_PAGES})"));
        }

        let body = json!({
            "query": TRANSFERS_PAGE_QUERY,
            "variables": {
                "from": from_iso,
                "to": to_iso,
                "after": after,
            }
        });
        let body_bytes = serde_json::to_vec(&body)
            .map_err(|err| format!("failed to serialize graphql request: {err}"))?;

        let request = CanisterHttpRequestArgument {
            url: graphql_url.to_string(),
            method: HttpMethod::POST,
            headers: vec![
                HttpHeader {
                    name: "User-Agent".to_string(),
                    value: "reef-metrics-onchain".to_string(),
                },
                HttpHeader {
                    name: "Accept".to_string(),
                    value: "application/json".to_string(),
                },
                HttpHeader {
                    name: "Content-Type".to_string(),
                    value: "application/json".to_string(),
                },
            ],
            body: Some(body_bytes),
            max_response_bytes: Some(2_000_000),
            transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
        };

        let (response,): (HttpResponse,) = ic_http::http_request(request, HTTP_CYCLES)
            .await
            .map_err(|(_, msg)| format!("http_request failed: {msg}"))?;

        if response.status != 200u16 {
            return Err(format!("upstream status {}", response.status));
        }

        let response_json: Value = serde_json::from_slice(&response.body)
            .map_err(|err| format!("failed to parse graphql response: {err}"))?;

        if let Some(errors) = response_json.get("errors") {
            return Err(format!("graphql error: {errors}"));
        }

        let connection = response_json
            .get("data")
            .and_then(|data| data.get("transfersConnection"))
            .ok_or_else(|| "missing transfersConnection".to_string())?;

        let edges = connection
            .get("edges")
            .and_then(|edges| edges.as_array())
            .ok_or_else(|| "missing edges".to_string())?;

        for edge in edges {
            let node = match edge.get("node") {
                Some(node) => node,
                None => continue,
            };
            if let Some(from_id) = node
                .get("from")
                .and_then(|from| from.get("id"))
                .and_then(|id| id.as_str())
            {
                active_wallets.insert(from_id.to_string());
            }
            if let Some(to_id) = node
                .get("to")
                .and_then(|to| to.get("id"))
                .and_then(|id| id.as_str())
            {
                active_wallets.insert(to_id.to_string());
            }
        }

        let page_info = connection
            .get("pageInfo")
            .and_then(|page_info| page_info.as_object())
            .ok_or_else(|| "missing pageInfo".to_string())?;

        let has_next = page_info
            .get("hasNextPage")
            .and_then(|flag| flag.as_bool())
            .unwrap_or(false);
        let end_cursor = page_info
            .get("endCursor")
            .and_then(|cursor| cursor.as_str())
            .map(|cursor| cursor.to_string());

        if has_next {
            if end_cursor.is_none() {
                return Err("hasNextPage true but endCursor missing".to_string());
            }
            after = end_cursor;
        } else {
            break;
        }
    }

    Ok(active_wallets)
}

ic_cdk::export_candid!();

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::management_canister::http_request as ic_http;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext,
};
use ic_cdk::api::time;
use ic_cdk::spawn;
use ic_cdk_timers::set_timer_interval;
use std::cell::RefCell;
use std::time::Duration;

const DEFAULT_SOURCE_URL: &str =
    "https://testexplore.onrender.com/v1/sparklines/active-wallets-daily?days=14";
const DEFAULT_PAYLOAD: &str = "{\"days\":14,\"series\":[]}";

#[derive(Clone, CandidType, Deserialize)]
struct State {
    owner: Principal,
    source_url: String,
    payload: String,
    last_updated: Option<u64>,
}

impl State {
    fn new(owner: Principal) -> Self {
        Self {
            owner,
            source_url: DEFAULT_SOURCE_URL.to_string(),
            payload: DEFAULT_PAYLOAD.to_string(),
            last_updated: None,
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::new(Principal::anonymous()));
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
}

#[ic_cdk::init]
fn init() {
    let owner = ic_cdk::caller();
    STATE.with(|state| {
        *state.borrow_mut() = State::new(owner);
    });

    init_timers();
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    let restored: Option<(State,)> = ic_cdk::storage::stable_restore().ok();
    if let Some((state,)) = restored {
        STATE.with(|s| *s.borrow_mut() = state);
    } else {
        let owner = ic_cdk::caller();
        STATE.with(|state| {
            *state.borrow_mut() = State::new(owner);
        });
    }

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
    let url = STATE.with(|state| state.borrow().source_url.clone());
    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::GET,
        headers: vec![
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "reef-metrics-onchain".to_string(),
            },
            HttpHeader {
                name: "Accept".to_string(),
                value: "application/json".to_string(),
            },
        ],
        body: None,
        max_response_bytes: Some(2_000_000),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
    };

    let cycles = 50_000_000_000u128; // adjust if needed
    let (response,): (HttpResponse,) = ic_http::http_request(request, cycles)
        .await
        .map_err(|(_, msg)| format!("http_request failed: {msg}"))?;

    if response.status != 200u16 {
        return Err(format!("upstream status {}", response.status));
    }

    let payload = String::from_utf8(response.body)
        .map_err(|_| "invalid utf8 response".to_string())?;

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.payload = payload.clone();
        state.last_updated = Some(time());
    });

    Ok(payload)
}

#[ic_cdk::query]
fn get_active_wallets_daily() -> String {
    STATE.with(|state| state.borrow().payload.clone())
}

#[ic_cdk::query]
fn get_status() -> Status {
    STATE.with(|state| {
        let state = state.borrow();
        Status {
            source_url: state.source_url.clone(),
            last_updated: state.last_updated,
            payload_bytes: state.payload.len() as u64,
        }
    })
}

#[ic_cdk::update]
fn set_source_url(url: String) {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    STATE.with(|state| {
        state.borrow_mut().source_url = url;
    });
}

#[ic_cdk::update]
async fn refresh_now() -> String {
    assert_owner().unwrap_or_else(|err| ic_cdk::trap(&err));
    refresh_internal().await.unwrap_or_else(|err| ic_cdk::trap(&err))
}

#[ic_cdk::query]
fn http_request(req: CanisterHttpRequest) -> CanisterHttpResponse {
    let path = req.url.split('?').next().unwrap_or("/");
    if path != "/" && path != "/active-wallets-daily.json" {
        return CanisterHttpResponse {
            status_code: 404,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: b"Not found".to_vec(),
        };
    }

    let payload = STATE.with(|state| state.borrow().payload.clone());
    CanisterHttpResponse {
        status_code: 200,
        headers: vec![
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Cache-Control".to_string(), "public, max-age=60".to_string()),
        ],
        body: payload.into_bytes(),
    }
}

#[ic_cdk::query]
fn transform(args: TransformArgs) -> HttpResponse {
    let mut response = args.response;
    response.headers.clear();
    response
}

ic_cdk::export_candid!();

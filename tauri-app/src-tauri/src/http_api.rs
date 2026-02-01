//! HTTP API server for LAN browser access
//! Exposes read-only endpoints that mirror Tauri commands

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use financial_pipeline::models::PaperTradeAction;
use financial_pipeline::{Database, QueuedTrade, QueueLogEntry, YahooFinance};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};

/// Shared state for HTTP handlers
pub type SharedDb = Arc<Mutex<Database>>;

// ============================================================================
// Trade Queue Types
// ============================================================================

/// Request to add a single trade to the queue
#[derive(Deserialize)]
pub struct AddToQueueRequest {
    pub portfolio: String,
    pub symbol: String,
    pub action: String,
    pub quantity: f64,
    pub target_price: Option<f64>,
    pub source: Option<String>,
    pub debate_date: Option<String>,
    pub conviction: Option<i32>,
    pub reasoning: Option<String>,
    pub scheduled_for: Option<String>,
}

/// Request to add multiple trades to the queue (batch from debate)
#[derive(Deserialize)]
pub struct AddBatchToQueueRequest {
    pub trades: Vec<AddToQueueRequest>,
}

/// Response for queue operations
#[derive(Serialize)]
pub struct QueueResponse {
    pub id: i64,
    pub status: String,
    pub message: String,
}

/// Batch response
#[derive(Serialize)]
pub struct BatchQueueResponse {
    pub queued: Vec<QueueResponse>,
    pub total: usize,
    pub success_count: usize,
    pub fail_count: usize,
}

/// Query params for queue listing
#[derive(Deserialize)]
pub struct QueueQuery {
    pub status: Option<String>,
    pub limit: Option<usize>,
}

/// Scheduler status response
#[derive(Serialize)]
pub struct SchedulerStatusResponse {
    pub running: bool,
    pub queued_count: i64,
    pub current_et_time: String,
    pub market_open: bool,
    pub next_market_open: String,
}

/// Symbol with price data
#[derive(Serialize)]
pub struct SymbolPrice {
    pub symbol: String,
    pub price: f64,
    pub change_percent: f64,
    pub change_direction: String,
    pub favorited: bool,
}

/// Price data point
#[derive(Serialize)]
pub struct PriceData {
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
}

/// Indicator data
#[derive(Serialize)]
pub struct IndicatorData {
    pub name: String,
    pub value: f64,
    pub date: String,
}

/// Portfolio position
#[derive(Serialize)]
pub struct Position {
    pub id: i64,
    pub symbol: String,
    pub quantity: f64,
    pub price: f64,
    pub position_type: String,
    pub date: String,
    pub current_price: f64,
    pub current_value: f64,
    pub profit_loss: f64,
    pub profit_loss_percent: f64,
}

/// Paper trading balance
#[derive(Serialize)]
pub struct PaperBalance {
    pub cash: f64,
    pub positions_value: f64,
    pub total_value: f64,
}

/// Paper position
#[derive(Serialize)]
pub struct PaperPosition {
    pub symbol: String,
    pub shares: f64,
    pub avg_cost: f64,
    pub current_price: f64,
    pub market_value: f64,
    pub unrealized_pnl: f64,
    pub unrealized_pnl_percent: f64,
}

/// Paper trade history
#[derive(Serialize)]
pub struct PaperTrade {
    pub id: i64,
    pub symbol: String,
    pub action: String,
    pub shares: f64,
    pub price: f64,
    pub total: f64,
    pub timestamp: String,
    pub reasoning: Option<String>,
}

/// DC balance
#[derive(Serialize)]
pub struct DcBalance {
    pub cash: f64,
    pub positions_value: f64,
    pub total_value: f64,
}

/// DC position
#[derive(Serialize)]
pub struct DcPosition {
    pub symbol: String,
    pub shares: f64,
    pub avg_cost: f64,
    pub current_price: f64,
    pub market_value: f64,
    pub unrealized_pnl: f64,
    pub unrealized_pnl_percent: f64,
}

/// Report item
#[derive(Serialize)]
pub struct ReportItem {
    pub name: String,
    pub path: String,
    pub date: String,
    pub report_type: String,
    pub size_kb: u64,
}

/// Alert
#[derive(Serialize)]
pub struct Alert {
    pub id: i64,
    pub symbol: String,
    pub target_price: f64,
    pub condition: String,
    pub triggered: bool,
}

/// AI Trade Decision
#[derive(Serialize)]
pub struct AiDecision {
    pub id: i64,
    pub session_id: i64,
    pub symbol: String,
    pub action: String,
    pub shares: f64,
    pub price: f64,
    pub confidence: f64,
    pub reasoning: String,
    pub timestamp: String,
    pub executed: bool,
}

/// Query params for price history
#[derive(Deserialize)]
pub struct PriceHistoryQuery {
    pub limit: Option<i32>,
}

/// Query params for indicators
#[derive(Deserialize)]
pub struct IndicatorQuery {
    pub limit: Option<i32>,
}

/// Request body for executing a paper trade
#[derive(Deserialize)]
pub struct ExecuteTradeRequest {
    pub symbol: String,
    pub action: String,  // "BUY" or "SELL"
    pub quantity: f64,
    pub price: Option<f64>,
    pub notes: Option<String>,
}

/// Response for executed trade
#[derive(Serialize)]
pub struct ExecuteTradeResponse {
    pub id: i64,
    pub symbol: String,
    pub action: String,
    pub quantity: f64,
    pub price: f64,
    pub total: f64,
    pub timestamp: String,
    pub success: bool,
    pub message: String,
}

/// Request body for refreshing prices from Yahoo Finance
#[derive(Deserialize)]
pub struct RefreshPricesRequest {
    pub symbols: Option<Vec<String>>,  // If None, refresh all favorited
    pub period: Option<String>,        // "1d", "5d", "1mo", etc. Default: "5d"
}

/// Response for price refresh
#[derive(Serialize)]
pub struct RefreshPricesResponse {
    pub success_count: i32,
    pub fail_count: i32,
    pub symbols_refreshed: Vec<String>,
    pub errors: Vec<String>,
}

/// Build the HTTP router with all endpoints
pub fn build_router(db: SharedDb) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Symbol/Price endpoints
        .route("/api/symbols", get(get_symbols))
        .route("/api/symbols/:symbol/price", get(get_price))
        .route("/api/symbols/:symbol/prices", get(get_price_history))
        .route("/api/symbols/:symbol/indicators", get(get_indicators))
        .route("/api/favorited", get(get_favorited_symbols))
        // Portfolio endpoints
        .route("/api/portfolio", get(get_portfolio))
        .route("/api/alerts", get(get_alerts))
        // Paper trading (KALIC)
        .route("/api/paper/balance", get(get_paper_balance))
        .route("/api/paper/positions", get(get_paper_positions))
        .route("/api/paper/trades", get(get_paper_trades))
        .route("/api/paper/trade", post(execute_paper_trade))
        // Price refresh
        .route("/api/refresh-prices", post(refresh_prices))
        // DC trading
        .route("/api/dc/balance", get(get_dc_balance))
        .route("/api/dc/positions", get(get_dc_positions))
        .route("/api/dc/trades", get(get_dc_trades))
        .route("/api/dc/trade", post(execute_dc_trade))
        // Competition
        .route("/api/competition/stats", get(get_competition_stats))
        // AI Trader
        .route("/api/ai/decisions", get(get_ai_decisions))
        .route("/api/ai/status", get(get_ai_status))
        // Reports
        .route("/api/reports", get(get_report_list))
        .route("/api/reports/content", get(get_report_content))
        // Watchlists
        .route("/api/watchlists", get(get_watchlists))
        // Trade queue management
        .route("/api/queue", get(get_trade_queue))
        .route("/api/queue/add", post(add_to_queue))
        .route("/api/queue/add-batch", post(add_batch_to_queue))
        .route("/api/queue/:id/cancel", post(cancel_queue_item))
        .route("/api/queue/:id/log", get(get_queue_item_log))
        .route("/api/queue/pending-count", get(get_pending_count))
        .route("/api/scheduler/status", get(get_scheduler_status))
        // Health check
        .route("/api/health", get(health_check))
        .layer(cors)
        .with_state(db)
}

/// Start the HTTP server on the specified port
pub async fn start_server(db: SharedDb, port: u16) {
    let router = build_router(db);
    let addr = format!("0.0.0.0:{}", port);

    log::info!("Starting HTTP API server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind HTTP server");

    axum::serve(listener, router)
        .await
        .expect("HTTP server error");
}

// === Handler functions ===

async fn health_check() -> &'static str {
    "OK"
}

async fn get_symbols(State(db): State<SharedDb>) -> Result<Json<Vec<SymbolPrice>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let symbols = db.get_symbols_with_data().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut result = Vec::new();
    for symbol in symbols {
        let favorited = db.is_symbol_favorited(&symbol).unwrap_or(false);

        if let Ok(prices) = db.get_prices(&symbol) {
            if prices.len() >= 2 {
                let current = prices.last().unwrap();
                let previous = &prices[prices.len() - 2];

                let change_percent = if previous.close > 0.0 {
                    ((current.close - previous.close) / previous.close) * 100.0
                } else {
                    0.0
                };

                let change_direction = if change_percent > 0.001 {
                    "up".to_string()
                } else if change_percent < -0.001 {
                    "down".to_string()
                } else {
                    "unchanged".to_string()
                };

                result.push(SymbolPrice {
                    symbol,
                    price: current.close,
                    change_percent,
                    change_direction,
                    favorited,
                });
            } else if let Some(price) = prices.last() {
                result.push(SymbolPrice {
                    symbol,
                    price: price.close,
                    change_percent: 0.0,
                    change_direction: "unchanged".to_string(),
                    favorited,
                });
            }
        }
    }

    Ok(Json(result))
}

async fn get_price(
    State(db): State<SharedDb>,
    Path(symbol): Path<String>,
) -> Result<Json<Option<f64>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let prices = db.get_prices(&symbol).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let price = prices.last().map(|p| p.close);

    Ok(Json(price))
}

async fn get_price_history(
    State(db): State<SharedDb>,
    Path(symbol): Path<String>,
    Query(params): Query<PriceHistoryQuery>,
) -> Result<Json<Vec<PriceData>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let prices = db.get_prices(&symbol).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let limit = params.limit.unwrap_or(100) as usize;
    let start = if prices.len() > limit { prices.len() - limit } else { 0 };

    let result: Vec<PriceData> = prices[start..]
        .iter()
        .map(|p| PriceData {
            date: p.date.to_string(), // Convert NaiveDate to String
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume,
        })
        .collect();

    Ok(Json(result))
}

async fn get_indicators(
    State(db): State<SharedDb>,
    Path(symbol): Path<String>,
    Query(_params): Query<IndicatorQuery>,
) -> Result<Json<Vec<IndicatorData>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get common indicators for this symbol
    let mut result = Vec::new();
    for indicator_name in ["sma_20", "sma_50", "rsi_14", "macd", "volume_sma_20"] {
        if let Ok(indicators) = db.get_indicator_history(&symbol, indicator_name) {
            if let Some(latest) = indicators.last() {
                result.push(IndicatorData {
                    name: indicator_name.to_string(),
                    value: latest.value,
                    date: latest.date.to_string(), // Convert NaiveDate to String
                });
            }
        }
    }

    Ok(Json(result))
}

async fn get_favorited_symbols(State(db): State<SharedDb>) -> Result<Json<Vec<String>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let symbols = db.get_favorited_symbols().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(symbols))
}

async fn get_portfolio(State(db): State<SharedDb>) -> Result<Json<Vec<Position>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let positions = db.get_positions().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<Position> = positions
        .into_iter()
        .map(|p| {
            let current_price = db.get_prices(&p.symbol)
                .ok()
                .and_then(|prices| prices.last().map(|px| px.close))
                .unwrap_or(p.price);

            let current_value = current_price * p.quantity;
            let cost_basis = p.price * p.quantity;
            let profit_loss = current_value - cost_basis;
            let profit_loss_percent = if cost_basis > 0.0 {
                (profit_loss / cost_basis) * 100.0
            } else {
                0.0
            };

            Position {
                id: p.id,
                symbol: p.symbol,
                quantity: p.quantity,
                price: p.price,
                position_type: format!("{:?}", p.position_type),
                date: p.date,
                current_price,
                current_value,
                profit_loss,
                profit_loss_percent,
            }
        })
        .collect();

    Ok(Json(result))
}

async fn get_alerts(State(db): State<SharedDb>) -> Result<Json<Vec<Alert>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let alerts = db.get_alerts(false).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; // false = show all alerts

    let result: Vec<Alert> = alerts
        .into_iter()
        .map(|a| Alert {
            id: a.id,
            symbol: a.symbol,
            target_price: a.target_price,
            condition: format!("{:?}", a.condition),
            triggered: a.triggered,
        })
        .collect();

    Ok(Json(result))
}

async fn get_paper_balance(State(db): State<SharedDb>) -> Result<Json<PaperBalance>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (cash, positions_value, total_value) = db
        .get_paper_portfolio_value()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(PaperBalance {
        cash,
        positions_value,
        total_value,
    }))
}

async fn get_paper_positions(State(db): State<SharedDb>) -> Result<Json<Vec<PaperPosition>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let positions = db.get_paper_positions().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<PaperPosition> = positions
        .into_iter()
        .map(|p| {
            let current_price = db.get_prices(&p.symbol)
                .ok()
                .and_then(|prices| prices.last().map(|px| px.close))
                .unwrap_or(p.entry_price);

            let market_value = current_price * p.quantity;
            let cost_basis = p.entry_price * p.quantity;
            let unrealized_pnl = market_value - cost_basis;
            let unrealized_pnl_percent = if cost_basis > 0.0 {
                (unrealized_pnl / cost_basis) * 100.0
            } else {
                0.0
            };

            PaperPosition {
                symbol: p.symbol,
                shares: p.quantity,
                avg_cost: p.entry_price,
                current_price,
                market_value,
                unrealized_pnl,
                unrealized_pnl_percent,
            }
        })
        .collect();

    Ok(Json(result))
}

async fn get_paper_trades(State(db): State<SharedDb>) -> Result<Json<Vec<PaperTrade>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trades = db.get_paper_trades(None, 100).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<PaperTrade> = trades
        .into_iter()
        .map(|t| PaperTrade {
            id: t.id,
            symbol: t.symbol,
            action: format!("{:?}", t.action),
            shares: t.quantity,
            price: t.price,
            total: t.quantity * t.price,
            timestamp: t.timestamp,
            reasoning: t.notes,
        })
        .collect();

    Ok(Json(result))
}

/// Execute a paper trade via HTTP POST
async fn execute_paper_trade(
    State(db): State<SharedDb>,
    Json(req): Json<ExecuteTradeRequest>,
) -> Result<Json<ExecuteTradeResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let symbol = req.symbol.to_uppercase();
    let action = match req.action.to_uppercase().as_str() {
        "BUY" => PaperTradeAction::Buy,
        "SELL" => PaperTradeAction::Sell,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    // Get current price if not provided
    let price = match req.price {
        Some(p) => p,
        None => {
            db.get_prices(&symbol)
                .ok()
                .and_then(|prices| prices.last().map(|p| p.close))
                .ok_or(StatusCode::BAD_REQUEST)?
        }
    };

    // Execute the trade
    let trade = db
        .execute_paper_trade(&symbol, action, req.quantity, price, None, req.notes.as_deref())
        .map_err(|e| {
            log::error!("Paper trade failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let total = trade.quantity * trade.price;
    log::info!(
        "[HTTP API] KALIC {} {} {} @ ${:.2} = ${:.2}",
        format!("{:?}", trade.action),
        trade.quantity,
        trade.symbol,
        trade.price,
        total
    );

    Ok(Json(ExecuteTradeResponse {
        id: trade.id,
        symbol: trade.symbol,
        action: format!("{:?}", trade.action),
        quantity: trade.quantity,
        price: trade.price,
        total,
        timestamp: trade.timestamp,
        success: true,
        message: format!("Trade executed successfully"),
    }))
}

/// Refresh prices from Yahoo Finance
async fn refresh_prices(
    State(db): State<SharedDb>,
    Json(req): Json<RefreshPricesRequest>,
) -> Result<Json<RefreshPricesResponse>, StatusCode> {
    // Get symbols to refresh first (quick DB read)
    let symbols: Vec<String> = {
        let db_guard = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        match &req.symbols {
            Some(s) => s.iter().map(|sym| sym.to_uppercase()).collect(),
            None => {
                let mut syms = db_guard.get_favorited_symbols().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                // Also include held positions from both portfolios
                if let Ok(positions) = db_guard.get_paper_positions() {
                    for p in &positions { syms.push(p.symbol.clone()); }
                }
                if let Ok(positions) = db_guard.get_dc_positions() {
                    for p in &positions { syms.push(p.symbol.clone()); }
                }
                syms.sort();
                syms.dedup();
                syms
            }
        }
    };

    let period = req.period.clone().unwrap_or_else(|| "5d".to_string());
    let db_clone = db.clone();

    // Run blocking Yahoo fetch in spawn_blocking
    let result = tokio::task::spawn_blocking(move || {
        let mut db_guard = db_clone.lock().map_err(|_| "DB lock failed".to_string())?;
        let yahoo = YahooFinance::new();

        let mut success_count = 0i32;
        let mut fail_count = 0i32;
        let mut symbols_refreshed = Vec::new();
        let mut errors = Vec::new();

        for symbol in &symbols {
            match yahoo.fetch_and_store(&mut db_guard, symbol, &period) {
                Ok(_) => {
                    success_count += 1;
                    symbols_refreshed.push(symbol.clone());
                    log::info!("[HTTP API] Refreshed prices for {}", symbol);
                }
                Err(e) => {
                    fail_count += 1;
                    errors.push(format!("{}: {}", symbol, e));
                    log::warn!("[HTTP API] Failed to refresh {}: {}", symbol, e);
                }
            }
        }

        log::info!(
            "[HTTP API] Price refresh complete: {} success, {} failed",
            success_count,
            fail_count
        );

        Ok::<RefreshPricesResponse, String>(RefreshPricesResponse {
            success_count,
            fail_count,
            symbols_refreshed,
            errors,
        })
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(result))
}

async fn get_dc_balance(State(db): State<SharedDb>) -> Result<Json<DcBalance>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (cash, positions_value, total_value) = db
        .get_dc_portfolio_value()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(DcBalance {
        cash,
        positions_value,
        total_value,
    }))
}

async fn get_dc_positions(State(db): State<SharedDb>) -> Result<Json<Vec<DcPosition>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let positions = db.get_dc_positions().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<DcPosition> = positions
        .into_iter()
        .map(|p| {
            let current_price = db.get_prices(&p.symbol)
                .ok()
                .and_then(|prices| prices.last().map(|px| px.close))
                .unwrap_or(p.entry_price);

            let market_value = current_price * p.quantity;
            let cost_basis = p.entry_price * p.quantity;
            let unrealized_pnl = market_value - cost_basis;
            let unrealized_pnl_percent = if cost_basis > 0.0 {
                (unrealized_pnl / cost_basis) * 100.0
            } else {
                0.0
            };

            DcPosition {
                symbol: p.symbol,
                shares: p.quantity,
                avg_cost: p.entry_price,
                current_price,
                market_value,
                unrealized_pnl,
                unrealized_pnl_percent,
            }
        })
        .collect();

    Ok(Json(result))
}

async fn get_dc_trades(State(db): State<SharedDb>) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trades = db.get_dc_trades(100).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<serde_json::Value> = trades
        .into_iter()
        .map(|t| serde_json::json!({
            "id": t.id,
            "symbol": t.symbol,
            "action": t.action,
            "shares": t.quantity,
            "price": t.price,
            "total": t.quantity * t.price,
            "timestamp": t.timestamp,
        }))
        .collect();

    Ok(Json(result))
}

/// Execute a DC trade via HTTP POST
async fn execute_dc_trade(
    State(db): State<SharedDb>,
    Json(req): Json<ExecuteTradeRequest>,
) -> Result<Json<ExecuteTradeResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let symbol = req.symbol.to_uppercase();
    let action = req.action.to_uppercase();

    if action != "BUY" && action != "SELL" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Get current price if not provided
    let price = match req.price {
        Some(p) => p,
        None => {
            db.get_prices(&symbol)
                .ok()
                .and_then(|prices| prices.last().map(|p| p.close))
                .ok_or(StatusCode::BAD_REQUEST)?
        }
    };

    let trade = db
        .execute_dc_trade(&symbol, &action, req.quantity, price, req.notes.as_deref())
        .map_err(|e| {
            log::error!("DC trade failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let total = trade.quantity * trade.price;
    log::info!(
        "[HTTP API] DC {} {} {} @ ${:.2} = ${:.2}",
        trade.action,
        trade.quantity,
        trade.symbol,
        trade.price,
        total
    );

    Ok(Json(ExecuteTradeResponse {
        id: trade.id,
        symbol: trade.symbol,
        action: trade.action,
        quantity: trade.quantity,
        price: trade.price,
        total,
        timestamp: trade.timestamp,
        success: true,
        message: format!("DC trade executed successfully"),
    }))
}

/// Competition stats between KALIC and DC
#[derive(Serialize)]
pub struct CompetitionStatsResponse {
    pub kalic_value: f64,
    pub kalic_pnl: f64,
    pub kalic_pnl_percent: f64,
    pub kalic_trades: i64,
    pub dc_value: f64,
    pub dc_pnl: f64,
    pub dc_pnl_percent: f64,
    pub dc_trades: i64,
    pub leader: String,
    pub lead_amount: f64,
}

async fn get_competition_stats(State(db): State<SharedDb>) -> Result<Json<CompetitionStatsResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let stats = db.get_competition_stats().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CompetitionStatsResponse {
        kalic_value: stats.kalic_total,
        kalic_pnl: stats.kalic_total - 100000.0, // Starting capital
        kalic_pnl_percent: stats.kalic_pnl_pct,
        kalic_trades: stats.kalic_trades as i64,
        dc_value: stats.dc_total,
        dc_pnl: stats.dc_total - 100000.0,
        dc_pnl_percent: stats.dc_pnl_pct,
        dc_trades: stats.dc_trades as i64,
        leader: stats.leader,
        lead_amount: stats.lead_amount,
    }))
}

async fn get_ai_decisions(State(db): State<SharedDb>) -> Result<Json<Vec<AiDecision>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let decisions = db.get_ai_decisions(None, None, 50).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<AiDecision> = decisions
        .into_iter()
        .map(|d| AiDecision {
            id: d.id,
            session_id: d.session_id.unwrap_or(0),
            symbol: d.symbol,
            action: d.action,
            shares: d.quantity.unwrap_or(0.0),
            price: d.price_at_decision.unwrap_or(0.0),
            confidence: d.confidence,
            reasoning: d.reasoning,
            timestamp: d.timestamp,
            executed: d.paper_trade_id.is_some(), // executed if linked to a trade
        })
        .collect();

    Ok(Json(result))
}

#[derive(Serialize)]
pub struct AiStatusResponse {
    pub active_session: bool,
    pub session_id: Option<i64>,
    pub total_decisions: i64,
    pub executed_trades: i64,
}

async fn get_ai_status(State(db): State<SharedDb>) -> Result<Json<AiStatusResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let session = db.get_active_ai_session().ok().flatten();
    let decisions = db.get_ai_decisions(None, None, 1000).unwrap_or_default();
    let executed = decisions.iter().filter(|d| d.paper_trade_id.is_some()).count() as i64;

    Ok(Json(AiStatusResponse {
        active_session: session.is_some(),
        session_id: session.map(|s| s.id),
        total_decisions: decisions.len() as i64,
        executed_trades: executed,
    }))
}

async fn get_report_list() -> Result<Json<Vec<ReportItem>>, StatusCode> {
    let mut reports = Vec::new();

    // Scan reports directory
    let reports_dir = if cfg!(windows) {
        r"X:\dev\carbyne-phinance/fp-tauri-dev\reports"
    } else {
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/reports"
    };

    // Scan trading sim logs
    let logs_dir = if cfg!(windows) {
        r"X:\dev\carbyne-phinance/fp-tauri-dev\logs\trading_sim_logs"
    } else {
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/logs/trading_sim_logs"
    };

    // Scan ai decisions logs
    let ai_decisions_dir = if cfg!(windows) {
        r"X:\dev\carbyne-phinance/fp-tauri-dev\logs\ai_decisions"
    } else {
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/logs/ai_decisions"
    };

    // Scan debate logs
    let debate_logs_dir = if cfg!(windows) {
        r"X:\dev\carbyne-phinance\fp-tauri-dev\debate-logs"
    } else {
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/debate-logs"
    };

    for dir in [reports_dir, logs_dir, ai_decisions_dir, debate_logs_dir] {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext == "md" || ext == "txt" || ext == "json" || ext == "jsonl" {
                            let name = path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let metadata = entry.metadata().ok();
                            let size_kb = metadata.as_ref()
                                .map(|m| m.len() / 1024)
                                .unwrap_or(0);

                            let date = metadata
                                .and_then(|m| m.modified().ok())
                                .map(|t| {
                                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                                    datetime.format("%Y-%m-%d").to_string()
                                })
                                .unwrap_or_default();

                            let report_type = if dir.contains("trading_sim") {
                                "trading_sim".to_string()
                            } else if dir.contains("ai_decisions") {
                                if name.contains("decisions_") {
                                    "daily_decisions".to_string()
                                } else if name == "index.json" {
                                    "index".to_string()
                                } else {
                                    "ai_decision".to_string()
                                }
                            } else if dir.contains("debate") {
                                "debate".to_string()
                            } else if name.contains("analysis") {
                                "analysis".to_string()
                            } else {
                                "general".to_string()
                            };

                            reports.push(ReportItem {
                                name,
                                path: path.to_string_lossy().to_string(),
                                date,
                                report_type,
                                size_kb,
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by date descending
    reports.sort_by(|a, b| b.date.cmp(&a.date));

    Ok(Json(reports))
}

#[derive(Deserialize)]
pub struct ReportContentQuery {
    pub path: String,
}

async fn get_report_content(
    Query(params): Query<ReportContentQuery>,
) -> Result<String, StatusCode> {
    // Security: only allow reading from known directories
    let allowed_prefixes = [
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/reports",
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev/logs",
        r"X:\dev\carbyne-phinance/fp-tauri-dev\reports",
        r"X:\dev\carbyne-phinance/fp-tauri-dev\logs",
    ];

    let path = &params.path;
    let allowed = allowed_prefixes.iter().any(|prefix| path.starts_with(prefix));

    if !allowed {
        return Err(StatusCode::FORBIDDEN);
    }

    std::fs::read_to_string(path).map_err(|_| StatusCode::NOT_FOUND)
}

#[derive(Serialize)]
pub struct WatchlistItem {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub symbols: Vec<String>,
}

async fn get_watchlists(State(db): State<SharedDb>) -> Result<Json<Vec<WatchlistItem>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // get_all_watchlists returns Vec<(i64, String, Option<String>, i64)> = (id, name, description, symbol_count)
    let watchlists = db.get_all_watchlists().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut result = Vec::new();
    for (id, name, description, _count) in watchlists {
        // Get the actual symbols for this watchlist - returns Vec<String> directly
        let symbols = db.get_watchlist(&name).unwrap_or_default();

        result.push(WatchlistItem {
            id,
            name,
            description,
            symbols,
        });
    }

    Ok(Json(result))
}

// ============================================================================
// Trade Queue Handlers
// ============================================================================

/// Get trade queue entries
async fn get_trade_queue(
    State(db): State<SharedDb>,
    Query(params): Query<QueueQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trades = match &params.status {
        Some(s) => db.get_queued_trades(Some(s)).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        None => db.get_trade_queue_all(params.limit.unwrap_or(100)).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    };

    let result: Vec<serde_json::Value> = trades.into_iter().map(|t| serde_json::json!({
        "id": t.id,
        "portfolio": t.portfolio,
        "symbol": t.symbol,
        "action": t.action,
        "quantity": t.quantity,
        "target_price": t.target_price,
        "status": t.status,
        "source": t.source,
        "debate_date": t.debate_date,
        "conviction": t.conviction,
        "reasoning": t.reasoning,
        "created_at": t.created_at,
        "scheduled_for": t.scheduled_for,
        "executed_at": t.executed_at,
        "execution_price": t.execution_price,
        "execution_trade_id": t.execution_trade_id,
        "error_message": t.error_message,
    })).collect();

    Ok(Json(result))
}

/// Add a single trade to the queue
async fn add_to_queue(
    State(db): State<SharedDb>,
    Json(req): Json<AddToQueueRequest>,
) -> Result<Json<QueueResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let portfolio = req.portfolio.to_uppercase();
    if portfolio != "KALIC" && portfolio != "DC" {
        return Ok(Json(QueueResponse {
            id: 0,
            status: "error".to_string(),
            message: "Portfolio must be KALIC or DC".to_string(),
        }));
    }

    let action = req.action.to_uppercase();
    if action != "BUY" && action != "SELL" {
        return Ok(Json(QueueResponse {
            id: 0,
            status: "error".to_string(),
            message: "Action must be BUY or SELL".to_string(),
        }));
    }

    let source = req.source.as_deref().unwrap_or("debate");

    match db.queue_trade(
        &portfolio,
        &req.symbol,
        &action,
        req.quantity,
        req.target_price,
        source,
        req.debate_date.as_deref(),
        req.conviction,
        req.reasoning.as_deref(),
        req.scheduled_for.as_deref(),
    ) {
        Ok(id) => {
            log::info!(
                "[QUEUE] Added: {} {} {} {} @ {} (conviction: {:?})",
                portfolio, action, req.quantity, req.symbol.to_uppercase(),
                req.target_price.map(|p| format!("${:.2}", p)).unwrap_or_else(|| "market".to_string()),
                req.conviction
            );
            Ok(Json(QueueResponse {
                id,
                status: "queued".to_string(),
                message: format!("Queued {} {} {} {}", portfolio, action, req.quantity, req.symbol.to_uppercase()),
            }))
        }
        Err(e) => {
            log::error!("[QUEUE] Failed to add: {}", e);
            Ok(Json(QueueResponse {
                id: 0,
                status: "error".to_string(),
                message: e.to_string(),
            }))
        }
    }
}

/// Add multiple trades to the queue (batch from debate)
async fn add_batch_to_queue(
    State(db): State<SharedDb>,
    Json(req): Json<AddBatchToQueueRequest>,
) -> Result<Json<BatchQueueResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = req.trades.len();
    let mut queued = Vec::new();
    let mut success_count = 0;
    let mut fail_count = 0;

    for trade in &req.trades {
        let portfolio = trade.portfolio.to_uppercase();
        let action = trade.action.to_uppercase();
        let source = trade.source.as_deref().unwrap_or("debate");

        match db.queue_trade(
            &portfolio,
            &trade.symbol,
            &action,
            trade.quantity,
            trade.target_price,
            source,
            trade.debate_date.as_deref(),
            trade.conviction,
            trade.reasoning.as_deref(),
            trade.scheduled_for.as_deref(),
        ) {
            Ok(id) => {
                success_count += 1;
                log::info!("[QUEUE] Batch: {} {} {} {}", portfolio, action, trade.quantity, trade.symbol);
                queued.push(QueueResponse {
                    id,
                    status: "queued".to_string(),
                    message: format!("{} {} {} {}", portfolio, action, trade.quantity, trade.symbol.to_uppercase()),
                });
            }
            Err(e) => {
                fail_count += 1;
                queued.push(QueueResponse {
                    id: 0,
                    status: "error".to_string(),
                    message: e.to_string(),
                });
            }
        }
    }

    log::info!("[QUEUE] Batch complete: {}/{} queued", success_count, total);

    Ok(Json(BatchQueueResponse {
        queued,
        total,
        success_count,
        fail_count,
    }))
}

/// Cancel a queued trade
async fn cancel_queue_item(
    State(db): State<SharedDb>,
    Path(id): Path<i64>,
) -> Result<Json<QueueResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match db.cancel_queued_trade(id) {
        Ok(()) => {
            log::info!("[QUEUE] Cancelled trade #{}", id);
            Ok(Json(QueueResponse {
                id,
                status: "cancelled".to_string(),
                message: format!("Trade #{} cancelled", id),
            }))
        }
        Err(e) => Ok(Json(QueueResponse {
            id,
            status: "error".to_string(),
            message: e.to_string(),
        })),
    }
}

/// Get audit log for a queue item
async fn get_queue_item_log(
    State(db): State<SharedDb>,
    Path(id): Path<i64>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let entries = db.get_queue_log(id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<serde_json::Value> = entries.into_iter().map(|e| serde_json::json!({
        "id": e.id,
        "queue_id": e.queue_id,
        "event": e.event,
        "details": e.details,
        "timestamp": e.timestamp,
    })).collect();

    Ok(Json(result))
}

/// Get count of pending queued trades
async fn get_pending_count(
    State(db): State<SharedDb>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let count = db.count_queued_trades("queued").unwrap_or(0);
    Ok(Json(serde_json::json!({ "count": count })))
}

/// Get scheduler status
async fn get_scheduler_status(
    State(db): State<SharedDb>,
) -> Result<Json<SchedulerStatusResponse>, StatusCode> {
    let db = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let queued_count = db.count_queued_trades("queued").unwrap_or(0);

    // Calculate current ET time
    use chrono::{Datelike, Timelike, Weekday};
    let now_utc = chrono::Utc::now();
    let month = now_utc.month();
    let is_dst = month >= 4 && month <= 10;
    let offset_hours: i64 = if is_dst { 4 } else { 5 };
    let now_et = now_utc - chrono::Duration::hours(offset_hours);
    let et_time = now_et.format("%Y-%m-%d %H:%M:%S ET").to_string();

    let hour = now_et.hour();
    let minute = now_et.minute();
    let weekday = now_et.weekday();

    let is_weekday = !matches!(weekday, Weekday::Sat | Weekday::Sun);
    let market_open = is_weekday && ((hour == 9 && minute >= 30) || (hour >= 10 && hour < 16));

    let next_open = if market_open {
        "NOW (market is open)".to_string()
    } else if is_weekday && (hour < 9 || (hour == 9 && minute < 30)) {
        format!("{} 09:30 ET", now_et.format("%Y-%m-%d"))
    } else {
        let mut days_ahead = 1i64;
        loop {
            let next = now_et + chrono::Duration::days(days_ahead);
            let wd = next.weekday();
            if !matches!(wd, Weekday::Sat | Weekday::Sun) {
                break format!("{} 09:30 ET", next.format("%Y-%m-%d"));
            }
            days_ahead += 1;
        }
    };

    Ok(Json(SchedulerStatusResponse {
        running: true,
        queued_count,
        current_et_time: et_time,
        market_open,
        next_market_open: next_open,
    }))
}

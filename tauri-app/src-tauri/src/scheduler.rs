//! Background scheduler for auto-executing queued trades at market open
//!
//! Runs as a tokio task, checks every 30 seconds, executes queued trades
//! at 9:30 ET on weekdays. Refreshes Yahoo prices before execution.

use crate::http_api::SharedDb;
use chrono::{Datelike, Timelike, Utc, Weekday};
use financial_pipeline::{YahooFinance, PaperTradeAction};
use std::collections::HashSet;
use std::io::Write;

/// Convert UTC to approximate ET (handles DST with month-based heuristic)
fn utc_to_et(utc: chrono::DateTime<Utc>) -> chrono::DateTime<Utc> {
    let month = utc.month();
    // DST: 2nd Sunday March through 1st Sunday November (simplified)
    let is_dst = month >= 4 && month <= 10;
    let offset_hours: i64 = if is_dst { 4 } else { 5 };
    utc - chrono::Duration::hours(offset_hours)
}

/// Get the base path for file output (cross-platform)
fn get_base_path() -> &'static str {
    if cfg!(windows) {
        r"X:\dev\carbyne-phinance\fp-tauri-dev"
    } else {
        "/mnt/x/dev/carbyne-phinance/fp-tauri-dev"
    }
}

/// Main scheduler loop - runs forever, checking every 30s
pub async fn run_scheduler(db: SharedDb) {
    log::info!("[SCHEDULER] Started - monitoring for queued trades at market open");

    // Track if we already executed today to avoid double-execution
    let mut last_execution_date: Option<String> = None;

    loop {
        let now_utc = Utc::now();
        let now_et = utc_to_et(now_utc);

        let hour = now_et.hour();
        let minute = now_et.minute();
        let weekday = now_et.weekday();
        let today = now_et.format("%Y-%m-%d").to_string();

        let is_weekday = !matches!(weekday, Weekday::Sat | Weekday::Sun);

        // Execute at 9:30 ET on weekdays, within a 2-minute window
        let is_market_open_window = is_weekday
            && hour == 9
            && minute >= 30
            && minute <= 31
            && last_execution_date.as_deref() != Some(&today);

        if is_market_open_window {
            // Check if there are queued trades
            let has_queued = {
                let db_guard = db.lock().unwrap();
                db_guard.count_queued_trades("queued").unwrap_or(0) > 0
            };

            if has_queued {
                log::info!("[SCHEDULER] Market open detected - executing queued trades");
                execute_queued_trades(&db).await;
                last_execution_date = Some(today);
            } else {
                log::info!("[SCHEDULER] Market open - no queued trades");
                last_execution_date = Some(today);
            }
        }

        // Sleep 30 seconds between checks
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    }
}

/// Execute all queued trades: refresh prices, execute, log results
async fn execute_queued_trades(db: &SharedDb) {
    // Step 1: Get all queued trades
    let queued = {
        let db_guard = db.lock().unwrap();
        db_guard.get_queued_trades(Some("queued")).unwrap_or_default()
    };

    if queued.is_empty() {
        return;
    }

    log::info!("[SCHEDULER] Found {} queued trades to execute", queued.len());

    // Step 2: Collect unique symbols and refresh prices
    let symbols: HashSet<String> = queued.iter().map(|t| t.symbol.clone()).collect();
    let symbols_vec: Vec<String> = symbols.into_iter().collect();

    refresh_prices_for_symbols(db, &symbols_vec).await;

    // Step 3: Execute each trade
    let mut results = Vec::new();

    for trade in &queued {
        // Mark as executing
        {
            let db_guard = db.lock().unwrap();
            db_guard.update_queue_status(trade.id, "executing", None, None, None).ok();
            db_guard.log_queue_event(trade.id, "executing", Some("Market open auto-execution")).ok();
        }

        // Get fresh price (use target if set, otherwise latest from DB)
        let price = {
            let db_guard = db.lock().unwrap();
            trade.target_price.unwrap_or_else(|| {
                db_guard.get_latest_price(&trade.symbol)
                    .ok()
                    .flatten()
                    .unwrap_or(0.0)
            })
        };

        if price <= 0.0 {
            let db_guard = db.lock().unwrap();
            db_guard.update_queue_status(trade.id, "failed", None, None,
                Some("Could not determine execution price")).ok();
            db_guard.log_queue_event(trade.id, "failed", Some("No price available")).ok();
            log::error!("[SCHEDULER] FAILED {} {} {} - no price", trade.portfolio, trade.action, trade.symbol);
            results.push((trade.clone(), "failed".to_string(), 0.0));
            continue;
        }

        // Execute based on portfolio type
        let exec_result = {
            let db_guard = db.lock().unwrap();
            match trade.portfolio.as_str() {
                "KALIC" => {
                    let action = match trade.action.as_str() {
                        "BUY" => PaperTradeAction::Buy,
                        "SELL" => PaperTradeAction::Sell,
                        _ => {
                            log::error!("[SCHEDULER] Invalid action: {}", trade.action);
                            results.push((trade.clone(), "failed".to_string(), 0.0));
                            continue;
                        }
                    };
                    db_guard.execute_paper_trade(
                        &trade.symbol, action, trade.quantity, price, None,
                        Some(&format!("[AUTO] {}", trade.reasoning.as_deref().unwrap_or("queued trade")))
                    ).map(|t| t.id)
                }
                "DC" => {
                    db_guard.execute_dc_trade(
                        &trade.symbol, &trade.action, trade.quantity, price,
                        Some(&format!("[AUTO] {}", trade.reasoning.as_deref().unwrap_or("queued trade")))
                    ).map(|t| t.id)
                }
                _ => {
                    log::error!("[SCHEDULER] Unknown portfolio: {}", trade.portfolio);
                    results.push((trade.clone(), "failed".to_string(), 0.0));
                    continue;
                }
            }
        };

        // Update queue status
        let db_guard = db.lock().unwrap();
        match exec_result {
            Ok(trade_id) => {
                db_guard.update_queue_status(trade.id, "executed", Some(price), Some(trade_id), None).ok();
                db_guard.log_queue_event(trade.id, "executed",
                    Some(&format!("Executed @ ${:.2}, trade_id={}", price, trade_id))).ok();
                log::info!("[SCHEDULER] EXECUTED {} {} {} {} @ ${:.2}",
                    trade.portfolio, trade.action, trade.quantity, trade.symbol, price);
                results.push((trade.clone(), "executed".to_string(), price));
            }
            Err(e) => {
                db_guard.update_queue_status(trade.id, "failed", None, None, Some(&e.to_string())).ok();
                db_guard.log_queue_event(trade.id, "failed", Some(&e.to_string())).ok();
                log::error!("[SCHEDULER] FAILED {} {} {} {}: {}",
                    trade.portfolio, trade.action, trade.quantity, trade.symbol, e);
                results.push((trade.clone(), "failed".to_string(), 0.0));
            }
        }
    }

    // Step 4: Write execution log to file
    write_execution_log(&results);
}

/// Refresh Yahoo Finance prices for the given symbols
async fn refresh_prices_for_symbols(db: &SharedDb, symbols: &[String]) {
    log::info!("[SCHEDULER] Refreshing prices for {} symbols", symbols.len());

    let db_clone = db.clone();
    let symbols = symbols.to_vec();

    let result = tokio::task::spawn_blocking(move || {
        let mut db_guard = db_clone.lock().unwrap();
        let yahoo = YahooFinance::new();

        for symbol in &symbols {
            match yahoo.fetch_and_store(&mut db_guard, symbol, "1d") {
                Ok(_) => log::info!("[SCHEDULER] Refreshed price: {}", symbol),
                Err(e) => log::warn!("[SCHEDULER] Failed to refresh {}: {}", symbol, e),
            }
        }
    }).await;

    if let Err(e) = result {
        log::error!("[SCHEDULER] Price refresh task failed: {}", e);
    }
}

/// Write execution summary to debate-logs directory
fn write_execution_log(results: &[(financial_pipeline::QueuedTrade, String, f64)]) {
    let base = get_base_path();
    let date = Utc::now().format("%Y-%m-%d").to_string();
    let log_path = format!("{}/debate-logs/{}_execution.md", base, date);

    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path);

    match file {
        Ok(mut f) => {
            let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
            writeln!(f, "\n## Auto-Execution Log - {}", timestamp).ok();
            writeln!(f, "| Portfolio | Symbol | Action | Qty | Price | Status |").ok();
            writeln!(f, "|-----------|--------|--------|-----|-------|--------|").ok();

            for (trade, status, price) in results {
                writeln!(f, "| {} | {} | {} | {} | ${:.2} | {} |",
                    trade.portfolio, trade.symbol, trade.action,
                    trade.quantity, price, status
                ).ok();
            }

            let executed = results.iter().filter(|(_, s, _)| s == "executed").count();
            let failed = results.iter().filter(|(_, s, _)| s == "failed").count();
            writeln!(f, "\n**Summary:** {} executed, {} failed out of {} total",
                executed, failed, results.len()
            ).ok();

            log::info!("[SCHEDULER] Execution log written to {}", log_path);
        }
        Err(e) => {
            log::error!("[SCHEDULER] Failed to write execution log: {}", e);
        }
    }
}

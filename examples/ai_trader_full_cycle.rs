//! Full AI Trader Cycle - Fetch data, compute signals, and run trading
//!
//! This example:
//! 1. Fetches latest price data from Yahoo Finance
//! 2. Computes technical indicators
//! 3. Generates trading signals
//! 4. Runs the AI trading cycle

use financial_pipeline::{
    Database, YahooFinance, AiTrader, SignalEngine, calculate_all,
};
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║        AI TRADER FULL CYCLE - FETCH, ANALYZE, TRADE         ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Symbols to trade
    let symbols = vec!["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "SPY"];

    // 1. Open database
    let db_path = r"X:\dev\carbyne-phinance/fp-tauri-dev\data\finance.db";
    println!("📂 Opening database: {}", db_path);
    let mut db = match Database::open(db_path) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("❌ Failed to open database: {}", e);
            return;
        }
    };

    // 2. Fetch price data from Yahoo Finance
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║              📊 FETCHING MARKET DATA                          ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    for symbol in symbols.iter().cloned() {
        print!("   Fetching {}... ", symbol);

        // Run blocking HTTP call in a separate thread
        let sym = symbol.to_string();
        let result = tokio::task::spawn_blocking(move || {
            let yahoo = YahooFinance::new();
            yahoo.fetch_prices(&sym, "3mo")
        }).await;

        match result {
            Ok(Ok(prices)) => {
                let count = prices.len();
                match db.upsert_daily_prices(&prices) {
                    Ok(_) => println!("✓ {} records", count),
                    Err(e) => println!("✗ DB error: {}", e),
                }
            }
            Ok(Err(e)) => println!("✗ {}", e),
            Err(e) => println!("✗ task error: {}", e),
        }
    }

    // 3. Compute indicators and signals
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║              📈 COMPUTING INDICATORS & SIGNALS               ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let signal_engine = SignalEngine::default();

    for symbol in &symbols {
        print!("   Processing {}... ", symbol);

        // Get prices from DB
        let prices = match db.get_prices(symbol) {
            Ok(p) => p,
            Err(e) => {
                println!("✗ {}", e);
                continue;
            }
        };

        if prices.is_empty() {
            println!("✗ no data");
            continue;
        }

        // Calculate all indicators
        let indicators = calculate_all(&prices);

        // Save indicators to DB
        if let Err(e) = db.upsert_indicators(&indicators) {
            println!("✗ indicator save error: {}", e);
            continue;
        }

        // Generate signals
        let signals = signal_engine.generate_signals(symbol, &indicators, &prices);

        // Save signals to DB
        let mut signal_count = 0;
        for signal in &signals {
            if db.upsert_signal(signal).is_ok() {
                signal_count += 1;
            }
        }

        // Detect confluence signals
        let today = prices.last().map(|p| p.date).unwrap();
        let latest_price = prices.last().map(|p| p.close).unwrap_or(0.0);

        // Build indicator map for latest date
        let mut indicator_map: HashMap<String, f64> = HashMap::new();
        for ind in &indicators {
            if ind.date == today {
                indicator_map.insert(ind.indicator_name.clone(), ind.value);
            }
        }

        if let Some(confluence) = signal_engine.detect_confluence_signal(symbol, today, latest_price, &indicator_map) {
            println!("✓ {} indicators, {} signals, confluence: {:?} ({:.2})",
                indicators.len(), signal_count, confluence.direction, confluence.strength);
        } else {
            println!("✓ {} indicators, {} signals", indicators.len(), signal_count);
        }
    }

    // 4. Show current market state
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║              📊 CURRENT MARKET STATE                         ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    for symbol in &symbols {
        if let Ok(prices) = db.get_prices(symbol) {
            if let Some(latest) = prices.last() {
                let prev = prices.get(prices.len().saturating_sub(2));
                let change = if let Some(p) = prev {
                    ((latest.close - p.close) / p.close) * 100.0
                } else {
                    0.0
                };
                let change_str = if change >= 0.0 { format!("+{:.2}%", change) } else { format!("{:.2}%", change) };
                println!("   {} ${:.2} ({})", symbol, latest.close, change_str);
            }
        }
    }

    // 5. Run AI trading cycle
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║              🤖 RUNNING AI TRADING CYCLE                     ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Get AI config
    let config = match db.get_ai_trader_config() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("❌ Failed to get config: {}", e);
            return;
        }
    };

    println!("   Config: ${:.0} starting capital", config.starting_capital);
    println!("   Models: {:?}", config.model_priority);

    let trader = AiTrader::new(config);

    // Check Ollama
    println!("\n   Checking Ollama...");
    if !trader.check_ollama().await {
        eprintln!("❌ Ollama is not available!");
        return;
    }
    println!("   ✓ Ollama is running");

    // Start or get session
    let _session = match db.get_active_ai_session() {
        Ok(Some(s)) => {
            println!("   ✓ Using existing session #{}", s.id);
            s
        }
        Ok(None) => {
            println!("   Starting new session...");
            match trader.start_session(&db) {
                Ok(s) => {
                    println!("   ✓ Session #{} started", s.id);
                    s
                }
                Err(e) => {
                    eprintln!("❌ Failed to start session: {}", e);
                    return;
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to check session: {}", e);
            return;
        }
    };

    // Run trading cycle
    println!("\n   🧠 AI analyzing market data...\n");

    match trader.run_cycle(&mut db).await {
        Ok(decisions) => {
            if decisions.is_empty() {
                println!("   📊 AI decided: No actions to take at this time.");
            } else {
                println!("   📊 AI made {} decision(s):\n", decisions.len());

                for (i, d) in decisions.iter().enumerate() {
                    println!("   ┌─ Decision {} ─────────────────────────────────────────┐", i + 1);
                    println!("   │ {} {} @ ${:.2}", d.action, d.symbol,
                        d.price_at_decision.unwrap_or(0.0));
                    if let Some(qty) = d.quantity {
                        println!("   │ Quantity: {:.0} shares", qty);
                    }
                    println!("   │ Confidence: {:.0}%", d.confidence * 100.0);
                    println!("   │ Model: {}", d.model_used);
                    println!("   │");
                    println!("   │ Reasoning:");
                    for line in d.reasoning.chars().collect::<Vec<_>>().chunks(50) {
                        let s: String = line.iter().collect();
                        println!("   │   {}", s);
                    }
                    if let (Some(dir), Some(target), Some(days)) =
                        (&d.predicted_direction, d.predicted_price_target, d.predicted_timeframe_days) {
                        println!("   │");
                        println!("   │ Prediction: {} to ${:.2} in {} days", dir, target, days);
                    }
                    println!("   └────────────────────────────────────────────────────────┘\n");
                }
            }
        }
        Err(e) => {
            eprintln!("   ❌ Trading cycle error: {}", e);
        }
    }

    // 6. Show portfolio status
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                    📈 PORTFOLIO STATUS                       ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let (cash, positions_val, total) = db.get_paper_portfolio_value().unwrap_or((0.0, 0.0, 0.0));
    let pnl = total - 1_000_000.0;
    let pnl_pct = (pnl / 1_000_000.0) * 100.0;

    println!("   Cash:       ${:>12.2}", cash);
    println!("   Positions:  ${:>12.2}", positions_val);
    println!("   ─────────────────────────");
    println!("   Total:      ${:>12.2}", total);
    println!("   P/L:        {:>+12.2} ({:+.2}%)\n", pnl, pnl_pct);

    // Show positions
    if let Ok(positions) = db.get_paper_positions() {
        if !positions.is_empty() {
            println!("   Open Positions:");
            for p in &positions {
                println!("   • {} x {:.0} @ ${:.2}", p.symbol, p.quantity, p.entry_price);
            }
            println!();
        }
    }

    // 7. AI stats
    if let Ok(status) = trader.get_status(&db) {
        println!("   Sessions: {} | Decisions: {} | Trades: {}",
            status.sessions_completed, status.total_decisions, status.total_trades);
    }

    println!("\n✅ Full AI trading cycle complete!");
}

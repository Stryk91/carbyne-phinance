//! Live AI Trader Test - Full autonomous trading cycle
//!
//! This runs the complete AI trading workflow:
//! 1. Check Ollama availability
//! 2. Start a trading session
//! 3. Run autonomous trading cycle
//! 4. Display results and reasoning

use financial_pipeline::{Database, AiTrader};

#[tokio::main]
async fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           AI TRADER LIVE TEST - FULL AUTONOMOUS CYCLE        ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // 1. Open database
    let db_path = r"X:\dev\financial-pipeline-rs\data\finance.db";
    println!("📂 Opening database: {}", db_path);
    let mut db = match Database::open(db_path) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("❌ Failed to open database: {}", e);
            return;
        }
    };

    // 2. Get AI trader config
    println!("⚙️  Loading AI trader configuration...");
    let config = match db.get_ai_trader_config() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("❌ Failed to get config: {}", e);
            return;
        }
    };

    println!("   Starting Capital: ${:.0}", config.starting_capital);
    println!("   Max Position Size: {}%", config.max_position_size_percent);
    println!("   Model Priority: {:?}", config.model_priority);
    println!("   Benchmark: {}\n", config.benchmark_symbol);

    // 3. Create AI Trader
    let trader = AiTrader::new(config);

    // 4. Check Ollama
    println!("🔌 Checking Ollama availability...");
    if !trader.check_ollama().await {
        eprintln!("❌ Ollama is not available! Start it with: ollama serve");
        return;
    }
    println!("   ✓ Ollama is running\n");

    // 5. Get current portfolio status
    println!("💰 Current Portfolio Status:");
    let (cash, positions_val, total) = db.get_paper_portfolio_value().unwrap_or((0.0, 0.0, 0.0));
    println!("   Cash: ${:.2}", cash);
    println!("   Positions: ${:.2}", positions_val);
    println!("   Total: ${:.2}\n", total);

    // 6. Check for active session or start new one
    println!("📋 Checking for active session...");
    let session = match db.get_active_ai_session() {
        Ok(Some(s)) => {
            println!("   ✓ Found active session #{}", s.id);
            s
        }
        Ok(None) => {
            println!("   Starting new session...");
            match trader.start_session(&db) {
                Ok(s) => {
                    println!("   ✓ Session #{} started!", s.id);
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
    println!();

    // 7. RUN THE TRADING CYCLE
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║              🤖 RUNNING AUTONOMOUS TRADING CYCLE             ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    match trader.run_cycle(&mut db).await {
        Ok(decisions) => {
            if decisions.is_empty() {
                println!("📊 AI decided: No actions to take at this time.\n");
            } else {
                println!("📊 AI made {} decision(s):\n", decisions.len());

                for (i, d) in decisions.iter().enumerate() {
                    println!("┌─ Decision {} ─────────────────────────────────────────────┐", i + 1);
                    println!("│ Action: {} {}", d.action, d.symbol);
                    if let Some(qty) = d.quantity {
                        println!("│ Quantity: {:.0} shares", qty);
                    }
                    if let Some(price) = d.price_at_decision {
                        println!("│ Price: ${:.2}", price);
                    }
                    println!("│ Confidence: {:.0}%", d.confidence * 100.0);
                    println!("│ Model: {}", d.model_used);
                    println!("│");
                    println!("│ Reasoning:");
                    // Word wrap reasoning at 60 chars
                    let reasoning = &d.reasoning;
                    for line in reasoning.chars().collect::<Vec<_>>().chunks(55) {
                        let s: String = line.iter().collect();
                        println!("│   {}", s);
                    }
                    if let (Some(dir), Some(target), Some(days)) =
                        (&d.predicted_direction, d.predicted_price_target, d.predicted_timeframe_days) {
                        println!("│");
                        println!("│ Prediction: {} to ${:.2} in {} days", dir, target, days);
                    }
                    println!("└───────────────────────────────────────────────────────────┘\n");
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Trading cycle failed: {}", e);
        }
    }

    // 8. Show updated portfolio
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                    📈 PORTFOLIO UPDATE                       ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let (cash, positions_val, total) = db.get_paper_portfolio_value().unwrap_or((0.0, 0.0, 0.0));
    let pnl = total - 1_000_000.0;
    let pnl_pct = (pnl / 1_000_000.0) * 100.0;

    println!("   Cash:       ${:>12.2}", cash);
    println!("   Positions:  ${:>12.2}", positions_val);
    println!("   ─────────────────────────");
    println!("   Total:      ${:>12.2}", total);
    println!("   P/L:        {:>+12.2} ({:+.2}%)", pnl, pnl_pct);
    println!();

    // Show positions
    if let Ok(positions) = db.get_paper_positions() {
        if !positions.is_empty() {
            println!("   Open Positions:");
            for p in &positions {
                println!("   • {} x {:.0} @ ${:.2} (entry: {})",
                    p.symbol, p.quantity, p.entry_price, p.entry_date);
            }
            println!();
        }
    }

    // 9. Get AI stats
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                     📊 AI TRADER STATS                       ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    if let Ok(status) = trader.get_status(&db) {
        println!("   Sessions Completed: {}", status.sessions_completed);
        println!("   Total Decisions:    {}", status.total_decisions);
        println!("   Total Trades:       {}", status.total_trades);
        println!("   Is Bankrupt:        {}", if status.is_bankrupt { "YES ☠️" } else { "No" });
    }

    // Prediction accuracy
    if let Ok(accuracy) = db.get_ai_prediction_accuracy() {
        if accuracy.total_predictions > 0 {
            println!("\n   Prediction Accuracy: {:.0}% ({}/{})",
                accuracy.accuracy_percent,
                accuracy.accurate_predictions,
                accuracy.total_predictions);
        }
    }

    println!("\n✅ AI Trader test complete!");
}

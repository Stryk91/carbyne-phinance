//! Fix database - create missing tables and reset paper wallet

use rusqlite::Connection;

fn main() {
    let conn = Connection::open(r"X:\dev\carbyne-phinance/fp-tauri-dev\data\finance.db")
        .expect("Failed to open database");

    println!("Fixing database...\n");

    // Create market_events if missing
    conn.execute(
        "CREATE TABLE IF NOT EXISTS market_events (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            sentiment REAL,
            embedding BLOB,
            created_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    ).expect("Failed to create market_events");
    println!("✓ market_events table exists");

    // Reset paper wallet to $1M (only cash column exists, no starting_capital)
    let updated = conn.execute(
        "UPDATE paper_wallet SET cash = 1000000.0, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
        [],
    ).expect("Failed to update paper wallet");

    if updated == 0 {
        // Insert if not exists
        conn.execute(
            "INSERT OR REPLACE INTO paper_wallet (id, cash) VALUES (1, 1000000.0)",
            [],
        ).expect("Failed to insert paper wallet");
    }
    println!("✓ Paper wallet reset to $1,000,000");

    // Update ai_trader_config starting capital
    conn.execute(
        "UPDATE ai_trader_config SET starting_capital = 1000000.0 WHERE id = 1",
        [],
    ).ok();
    println!("✓ AI trader config updated");

    // Clear existing paper positions (fresh start)
    conn.execute("DELETE FROM paper_positions", []).ok();
    println!("✓ Paper positions cleared");

    // Clear existing paper trades (fresh start)
    conn.execute("DELETE FROM paper_trades", []).ok();
    println!("✓ Paper trades cleared");

    // Clear AI sessions for fresh start
    conn.execute("DELETE FROM ai_trading_sessions", []).ok();
    conn.execute("DELETE FROM ai_trade_decisions", []).ok();
    conn.execute("DELETE FROM ai_performance_snapshots", []).ok();
    println!("✓ AI trading data cleared");

    // Show current state
    let cash: f64 = conn.query_row(
        "SELECT cash FROM paper_wallet WHERE id = 1",
        [],
        |r| r.get(0),
    ).expect("Failed to query paper wallet");

    let starting_capital: f64 = conn.query_row(
        "SELECT starting_capital FROM ai_trader_config WHERE id = 1",
        [],
        |r| r.get(0),
    ).unwrap_or(1_000_000.0);

    println!("\n📊 Current State:");
    println!("   Cash: ${:.2}", cash);
    println!("   Starting Capital (config): ${:.2}", starting_capital);

    println!("\n✅ Database fixed and ready for AI trading!");
}

//! Initialize AI Trader tables in the database

use rusqlite::Connection;

fn main() {
    let db_path = r"X:\dev\financial-pipeline-rs\data\finance.db";
    println!("Opening database: {}", db_path);

    let conn = Connection::open(db_path).expect("Failed to open database");

    println!("Creating AI trader tables...");

    // AI Trader Configuration
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_trader_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            starting_capital REAL NOT NULL DEFAULT 1000000.0,
            max_position_size_percent REAL NOT NULL DEFAULT 10.0,
            stop_loss_percent REAL NOT NULL DEFAULT 5.0,
            take_profit_percent REAL NOT NULL DEFAULT 15.0,
            session_duration_minutes INTEGER NOT NULL DEFAULT 60,
            benchmark_symbol TEXT NOT NULL DEFAULT 'SPY',
            model_priority TEXT NOT NULL DEFAULT 'deepseek-v3.2:cloud,gpt-oss:120b-cloud,qwen3:235b',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    ).expect("Failed to create ai_trader_config");
    println!("  ✓ ai_trader_config");

    // Insert default config
    conn.execute(
        "INSERT OR IGNORE INTO ai_trader_config (id) VALUES (1)",
        [],
    ).expect("Failed to insert default config");
    println!("  ✓ default config inserted");

    // AI Trading Sessions
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_trading_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT NOT NULL DEFAULT (datetime('now')),
            end_time TEXT,
            starting_portfolio_value REAL NOT NULL,
            ending_portfolio_value REAL,
            decisions_count INTEGER NOT NULL DEFAULT 0,
            trades_count INTEGER NOT NULL DEFAULT 0,
            session_notes TEXT,
            status TEXT NOT NULL DEFAULT 'active'
        )",
        [],
    ).expect("Failed to create ai_trading_sessions");
    println!("  ✓ ai_trading_sessions");

    // AI Trade Decisions
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_trade_decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES ai_trading_sessions(id),
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            action TEXT NOT NULL,
            symbol TEXT NOT NULL,
            quantity REAL,
            price_at_decision REAL,
            confidence REAL NOT NULL,
            reasoning TEXT NOT NULL,
            model_used TEXT NOT NULL,
            predicted_direction TEXT,
            predicted_price_target REAL,
            predicted_timeframe_days INTEGER,
            actual_outcome TEXT,
            actual_price_at_timeframe REAL,
            prediction_accurate INTEGER,
            paper_trade_id INTEGER REFERENCES paper_trades(id)
        )",
        [],
    ).expect("Failed to create ai_trade_decisions");
    println!("  ✓ ai_trade_decisions");

    // AI Performance Snapshots
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_performance_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            portfolio_value REAL NOT NULL,
            cash REAL NOT NULL,
            positions_value REAL NOT NULL,
            benchmark_value REAL NOT NULL,
            benchmark_symbol TEXT NOT NULL,
            total_pnl REAL NOT NULL,
            total_pnl_percent REAL NOT NULL,
            benchmark_pnl_percent REAL NOT NULL,
            prediction_accuracy REAL,
            trades_to_date INTEGER NOT NULL DEFAULT 0,
            winning_trades INTEGER NOT NULL DEFAULT 0,
            losing_trades INTEGER NOT NULL DEFAULT 0,
            win_rate REAL
        )",
        [],
    ).expect("Failed to create ai_performance_snapshots");
    println!("  ✓ ai_performance_snapshots");

    // Verify
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'ai_%'",
        [],
        |row| row.get(0),
    ).unwrap();

    println!("\n✅ Created {} AI tables!", count);

    // Show config
    let (capital, benchmark): (f64, String) = conn.query_row(
        "SELECT starting_capital, benchmark_symbol FROM ai_trader_config WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap();

    println!("   Config: ${:.0} starting capital, benchmark: {}", capital, benchmark);
}

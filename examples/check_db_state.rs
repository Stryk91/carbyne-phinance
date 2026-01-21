//! Check database state for AI trader

use rusqlite::Connection;

fn main() {
    let conn = Connection::open(r"X:\dev\financial-pipeline-rs\data\finance.db")
        .expect("Failed to open database");

    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                    DATABASE STATE CHECK                      ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Check price_history
    let price_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM price_history",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    println!("📊 Price history records: {}", price_count);

    // Check symbols
    let mut stmt = conn.prepare(
        "SELECT symbol, COUNT(*) as cnt FROM price_history GROUP BY symbol ORDER BY cnt DESC LIMIT 10"
    ).ok();

    if let Some(ref mut s) = stmt {
        println!("\n📈 Symbols with price data:");
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        });
        if let Ok(rows) = rows {
            for row in rows.flatten() {
                println!("   {} - {} records", row.0, row.1);
            }
        }
    }

    // Check signals
    let signals_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM signals",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    println!("\n🎯 Signals: {}", signals_count);

    // Check recent signals
    let mut stmt = conn.prepare(
        "SELECT symbol, signal_type, date FROM signals ORDER BY date DESC LIMIT 5"
    ).ok();

    if let Some(ref mut s) = stmt {
        println!("\n🔔 Recent signals:");
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        });
        if let Ok(rows) = rows {
            for row in rows.flatten() {
                println!("   {} {} @ {}", row.0, row.1, row.2);
            }
        }
    }

    // Check indicators
    let indicators_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM indicators",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    println!("\n📉 Indicators: {}", indicators_count);

    // Check market events
    let events_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM market_events",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    println!("📰 Market events: {}", events_count);

    // Check paper wallet
    let cash: f64 = conn.query_row(
        "SELECT cash FROM paper_wallet WHERE id = 1",
        [],
        |r| r.get(0),
    ).unwrap_or(0.0);
    println!("\n💰 Paper wallet cash: ${:.2}", cash);

    // Check AI sessions
    let sessions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM ai_trading_sessions",
        [],
        |r| r.get(0),
    ).unwrap_or(0);
    println!("🤖 AI sessions: {}", sessions);

    println!("\n✅ Database state check complete!");
}

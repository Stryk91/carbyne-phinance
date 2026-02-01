//! Update AI Trader config for more aggressive trading

use rusqlite::Connection;

fn main() {
    let conn = Connection::open(r"X:\dev\carbyne-phinance/fp-tauri-dev\data\finance.db")
        .expect("Failed to open database");

    println!("Updating AI Trader config...\n");

    // More aggressive settings:
    // - 25% max position (instead of 10%) - allows 4 positions to use 100%
    // - Use available cloud models (gpt-oss and qwen3-coder confirmed available)
    conn.execute(
        "UPDATE ai_trader_config SET
            max_position_size_percent = 25.0,
            model_priority = 'gpt-oss:120b-cloud,qwen3-coder:480b-cloud'
         WHERE id = 1",
        [],
    ).expect("Failed to update config");

    // Verify
    let (max_pos, models): (f64, String) = conn.query_row(
        "SELECT max_position_size_percent, model_priority FROM ai_trader_config WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).expect("Failed to query");

    println!("✓ Max position size: {}%", max_pos);
    println!("✓ Model priority: {}", models);
    println!("\n✅ Config updated - AI will trade more aggressively!");
}

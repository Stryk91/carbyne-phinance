//! Fetch prices for ALL symbols in the database
//! Run: cargo run --example fetch_all_prices

use financial_pipeline::{Database, YahooFinance};

#[tokio::main]
async fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║            FETCH ALL SYMBOL PRICES FROM YAHOO                ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let db_path = r"X:\dev\carbyne-phinance/fp-tauri-dev\data\finance.db";
    println!("📂 Opening database: {}", db_path);

    let mut db = match Database::open(db_path) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("❌ Failed to open database: {}", e);
            return;
        }
    };

    // Get favorited symbols from DB
    let symbols = match db.get_favorited_symbols() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ Failed to get symbols: {}", e);
            return;
        }
    };

    println!("📊 Found {} favorited symbols\n", symbols.len());

    let mut success_count = 0;
    let mut error_count = 0;

    for symbol in &symbols {
        print!("   Fetching {}... ", symbol);

        let sym = symbol.clone();
        let result = tokio::task::spawn_blocking(move || {
            let yahoo = YahooFinance::new();
            yahoo.fetch_prices(&sym, "1mo")
        }).await;

        match result {
            Ok(Ok(prices)) => {
                let count = prices.len();
                if count > 0 {
                    match db.upsert_daily_prices(&prices) {
                        Ok(_) => {
                            println!("✓ {} records", count);
                            success_count += 1;
                        }
                        Err(e) => {
                            println!("✗ DB error: {}", e);
                            error_count += 1;
                        }
                    }
                } else {
                    println!("✗ no data");
                    error_count += 1;
                }
            }
            Ok(Err(e)) => {
                println!("✗ {}", e);
                error_count += 1;
            }
            Err(e) => {
                println!("✗ task error: {}", e);
                error_count += 1;
            }
        }

        // Small delay to avoid rate limiting
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }

    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║                        SUMMARY                               ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("\n   ✓ Success: {}", success_count);
    println!("   ✗ Errors:  {}", error_count);
    println!("\n✅ Price fetch complete!");
}

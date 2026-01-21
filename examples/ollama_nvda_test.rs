//! Test Ollama integration with NVDA data

use financial_pipeline::{Database, ollama::{OllamaClient, MODEL_HEAVY}};

#[tokio::main]
async fn main() {
    println!("=== Ollama NVDA Integration Test ===\n");

    // 1. Check Ollama availability (use heavy model since 20b isn't available)
    let client = OllamaClient::new().with_model(MODEL_HEAVY);
    println!("1. Checking Ollama availability...");
    let available = client.is_available().await;
    println!("   Ollama available: {}\n", available);
    
    if !available {
        println!("ERROR: Ollama not running at localhost:11434");
        println!("Start it with: ollama serve");
        return;
    }
    
    // 2. Load NVDA data from database
    println!("2. Loading NVDA data from database...");
    let db_path = r"X:\dev\financial-pipeline-rs\data\finance.db";
    let db = match Database::open(db_path) {
        Ok(d) => d,
        Err(e) => {
            println!("   ERROR opening database: {}", e);
            return;
        }
    };
    
    let prices = match db.get_prices("NVDA") {
        Ok(p) => p,
        Err(e) => {
            println!("   ERROR getting NVDA prices: {}", e);
            return;
        }
    };
    
    println!("   Found {} NVDA price records", prices.len());
    
    if prices.is_empty() {
        println!("   No NVDA data found!");
        return;
    }
    
    // Get last 10 days
    let recent: Vec<_> = prices.iter().rev().take(10).collect();
    println!("   Recent prices:");
    for p in recent.iter().take(5) {
        println!("   {} - O:{:.2} H:{:.2} L:{:.2} C:{:.2}", 
            p.date, p.open, p.high, p.low, p.close);
    }
    
    // 3. Test sentiment analysis
    println!("\n3. Testing sentiment analysis...");
    let news_text = format!(
        "NVDA stock closed at ${:.2} today, {} from previous close. \
        The AI chip maker continues to dominate the GPU market.",
        recent[0].close,
        if recent.len() > 1 && recent[0].close > recent[1].close { "up" } else { "down" }
    );
    println!("   Text: {}", news_text);
    
    match client.analyze_sentiment(&news_text).await {
        Ok(result) => {
            println!("   Sentiment: {:?}", result.sentiment);
            println!("   Confidence: {:.2}", result.confidence);
            println!("   Reasoning: {}", result.reasoning);
        }
        Err(e) => println!("   ERROR: {}", e),
    }
    
    // 4. Test pattern explanation
    println!("\n4. Testing pattern explanation...");
    let context = format!("NVDA recent price: ${:.2}", recent[0].close);
    
    match client.explain_pattern("MACD Bullish Cross", &context).await {
        Ok(result) => {
            println!("   Pattern: {}", result.pattern_name);
            println!("   Explanation: {}", result.explanation);
            println!("   Typical outcome: {}", result.typical_outcome);
            println!("   Confidence: {}", result.confidence_level);
        }
        Err(e) => println!("   ERROR: {}", e),
    }
    
    // 5. Test price narration
    println!("\n5. Testing price action narration...");
    let price_data: Vec<_> = recent.iter()
        .map(|p| (p.date.to_string(), p.open, p.high, p.low, p.close, p.volume))
        .collect();
    
    match client.narrate_price_action("NVDA", &price_data).await {
        Ok(narration) => {
            println!("   Narration: {}", narration);
        }
        Err(e) => println!("   ERROR: {}", e),
    }
    
    // 6. Test Q&A
    println!("\n6. Testing Q&A...");
    let context = format!(
        "NVDA (NVIDIA) recent prices:\n{}",
        recent.iter().take(5)
            .map(|p| format!("{}: ${:.2}", p.date, p.close))
            .collect::<Vec<_>>()
            .join("\n")
    );
    
    match client.answer_query("What is the trend for NVDA and should I buy?", &context).await {
        Ok(answer) => {
            println!("   Answer: {}", answer);
        }
        Err(e) => println!("   ERROR: {}", e),
    }
    
    println!("\n=== Test Complete ===");
}

# Ollama Integration Spec for Financial Pipeline

## Overview
Local LLM integration via Ollama API (localhost:11434) for AI-powered analysis.

## Model Choice
- **gpt-oss:20b-cloud** - Default, fast for quick queries
- **gpt-oss:120b-cloud** - Heavy lifting, complex analysis

## New File: src/ollama.rs

### Structs
- OllamaClient - HTTP client wrapper
- SentimentResult - {sentiment, confidence, reasoning}
- PatternExplanation - {pattern_name, explanation, typical_outcome, confidence_level}

### Functions
| Function | Purpose |
|----------|---------|
| 
ew() | Create client with default model |
| is_available() | Check if Ollama running (2s timeout) |
| query(prompt, system) | Raw LLM query |
| nalyze_sentiment(text) | News → bullish/bearish/neutral |
| xplain_pattern(name, context) | Pattern education |
| 
arrate_price_action(symbol, data) | Generate summary |
| nswer_query(question, context) | Natural language Q&A |

## Tauri Commands (lib.rs)

`ust
#[tauri::command]
fn ollama_sentiment(text: String) -> Result<SentimentResult, String>

#[tauri::command]
fn ollama_explain(pattern: String) -> Result<PatternExplanation, String>

#[tauri::command]
fn ollama_ask(question: String, context: String) -> Result<String, String>

#[tauri::command]
fn ollama_available() -> bool
`

## Frontend (api.ts)

`	ypescript
export async function checkOllamaAvailable(): Promise<boolean>
export async function analyzeSentiment(text: string): Promise<SentimentResult>
export async function explainPattern(pattern: string): Promise<PatternExplanation>
export async function askOllama(question: string, context: string): Promise<string>
`

## UI Integration Points
1. News card → "Analyze Sentiment" button
2. Pattern detection → "Explain" tooltip/modal
3. Global → "Ask AI" input box
4. Settings → Model selector (20b vs 120b)

## Graceful Degradation
- is_available() check before any call
- UI hides AI features if Ollama offline
- No errors thrown, just silent skip

## Dependencies
Already have: reqwest, serde, serde_json, anyhow

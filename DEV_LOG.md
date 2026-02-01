# Financial Pipeline Dev Log

> **Location:** `X:\dev\financial-pipeline-rs\DEV_LOG.md`  
> **Purpose:** Living document of changes, errors, solutions. DC reads via project files. KALIC writes during work.

---

## Format Guide

### Changes
```
## [YYYY-MM-DD] Brief Title
**Author:** KALIC | DC | STRYK
**Files:** path/to/file.rs, another/file.ts
**Summary:** What changed and why

- Bullet points of specific changes
- Keep it concise
```

### Errors & Solutions
```
### âŒ ERROR: Brief description
**When:** What triggered it
**Fix:** How it was solved
**Prevention:** How to avoid in future (optional)
```

---

## Log Entries

## [2026-01-21] PATH Self-Healing System
**Author:** DC
**Files:** `X:\dev\tools\kalic-path-hook.ps1`, PhiSHRI T45WIN_ENV_BOOTSTRAP
**Summary:** Created permanent fix for Windows PATH inheritance issues across WSL boundary

- Created `kalic-path-hook.ps1` with canonical paths for npm, node, cargo, git
- Functions: `Repair-PathForTool`, `Get-FullToolPath`, `Initialize-KalicEnv`
- PhiSHRI door T45WIN_ENV_BOOTSTRAP documents all known PATH issues
- KALIC should run `Initialize-KalicEnv` at session start

### âŒ ERROR: npm not recognized in WSL->PowerShell
**When:** Every time KALIC runs npm from WSL bash calling PowerShell
**Fix:** `. "X:\dev\tools\kalic-path-hook.ps1"; Repair-PathForTool "npm"`
**Prevention:** Run `Initialize-KalicEnv` at session start

---

## [2026-01-21] PhiSHRI Path Correction
**Author:** DC
**Files:** `claude_desktop_config.json`
**Summary:** MCP was pointing to stale PhiSHRI location with 567 doors instead of production 802

- Changed `PHISHRI_PATH` from `C:\Users\Stryker\.phishri\knowledge` to `C:\Dev\PhiSHRI\PhiSHRI`
- Changed `PHISHRI_SESSION_ROOT` to `C:\Dev\PhiSHRI`
- Requires Claude Desktop restart to take effect

---

## [2026-01-21] Tauri devUrl localhost fix
**Author:** KALIC
**Files:** `tauri-app/src-tauri/tauri.conf.json`
**Summary:** Fixed hardcoded IP that broke every rebuild

- Changed devUrl from `10.0.134.178:1420` to `localhost:1420`
- Applied `git update-index --skip-worktree` to prevent tracking local changes
- No more editing this file every compile

---

## [2026-01-21] Finnhub API Expansion - News Pattern Linking
**Author:** KALIC
**Files:** `src/finnhub.rs`, `tauri-app/src-tauri/src/lib.rs`, `tauri-app/src/api.ts`
**Summary:** Auto-link price patterns to news events

- Quote, Candles, PriceReaction structs implemented
- `add_market_event_with_pattern` Tauri command
- UI checkbox "Auto-link price patterns" + Save All button
- Fetches Â±3 day candles around news event date

---


---

## [2026-01-21] News Cards Enhanced with Price + Sentiment
**Author:** KALIC
**Files:** `src-tauri/src/lib.rs,src/api.ts,src/main.ts,src/chart.ts,src-tauri/tauri.conf.json`
**Summary:** News cards now show price at date, daily % change, and outcome-based sentiment

- Added `fetch_candles` Tauri command returning raw OHLCV data with dates
- News cards display: `$142.50 ▲2.3% BULLISH` on header row
- Sentiment is outcome-based (actual price movement): ≥+2% = BULLISH, ≤-2% = BEARISH
- Fixed CSP: added `http://ipc.localhost` to `connect-src`
- Fixed chart "Value is null" error in time scale sync
- Used `npm run tauri build` (not just `cargo build`) to bundle frontend


### âŒ ERROR: Finnhub candles 403 Forbidden
**When:** Fetching price data for news cards
**Fix:** Use local Yahoo price history instead of Finnhub /stock/candle
**Prevention:** Finnhub free tier restricts candle data; always try local data first

---

## [2026-01-21] Paper Trading Simulator - Backend Complete
**Author:** KALIC
**Files:** `src/models.rs`, `src/db.rs`, `src/lib.rs`, `tauri-app/src-tauri/src/lib.rs`, `tauri-app/src/api.ts`
**Summary:** Implemented paper trading system per TRADING_SIM_SPEC.md

**Database:**
- `paper_wallet` table - singleton with $100k starting cash
- `paper_positions` table - open positions with entry price/date
- `paper_trades` table - full trade history with P&L

**Rust Models:**
- `PaperWallet`, `PaperPosition`, `PaperTrade`, `PaperTradeAction` structs

**Database Methods:**
- `get_paper_wallet()` - get cash balance
- `get_paper_positions()` / `get_paper_position(symbol)` - get positions
- `execute_paper_trade(symbol, action, qty, price, ...)` - BUY/SELL with validation
- `get_paper_trades(symbol, limit)` - trade history
- `reset_paper_account(starting_cash)` - reset to clean state
- `get_paper_portfolio_value()` - (cash, positions_value, total_equity)

**Tauri Commands:**
- `get_paper_balance` - wallet summary with P&L
- `get_paper_positions` - positions with current prices and unrealized P&L
- `execute_paper_trade` - execute trade (validates cash/shares)
- `get_paper_trades` - trade history
- `reset_paper_account` - reset account

**TypeScript API (api.ts):**
- Full type definitions and async functions for all commands

**Build Status:** Compiles (both lib and tauri-app)

**Next:** Frontend UI (sidebar panel for trading)

---

## [2026-01-21] AI Trader Guardrails & Circuit Breaker
**Author:** KALIC
**Files:** `src/ai_trader.rs`, `src/db.rs`, `src/models.rs`, `src/ollama.rs`, `tauri-app/src-tauri/src/lib.rs`
**Summary:** Implemented autonomous trading safety system per DC spec

**Trading Modes (TradingMode enum):**
- `Aggressive` - 33% max position, 20 trades/day, no confluence required (STRYK override only)
- `Normal` - 10% max position, 10 trades/day, confluence required (default)
- `Conservative` - 5% max position, 5 trades/day, strict confluence (circuit breaker fallback)
- `Paused` - No new trades, position management only

**Circuit Breaker:**
- -10% daily loss threshold → auto-switch to conservative
- 5 consecutive losses → 1 hour trading pause
- Auto-conservative on trigger (configurable)
- All triggers logged to `circuit_breaker_events` table

**TradeResult Enum (Audit Trail):**
- `Executed { trade_id, symbol, action, quantity, price, value, timestamp }`
- `Queued { reason, review_by, proposed_trade }`
- `Rejected { reason, rule_triggered, proposed_trade }`

**Override Escape Hatch:**
- Time-limited elevated permissions for STRYK
- `Override::timed(hours, max_pct, reason)` with auto-expiry
- Audit logged with reason

**Database:**
- `trade_rejections` table - every rejected trade with reason + rule
- `circuit_breaker_events` table - trigger history
- Extended `ai_trader_config` with mode, CB settings, guardrails
- Migration support for existing databases

**Tauri Commands:**
- `ai_trader_get_mode` / `ai_trader_switch_mode`
- `ai_trader_get_circuit_breaker` / `ai_trader_update_circuit_breaker`
- `ai_trader_get_rejections` / `ai_trader_get_circuit_breaker_events`

**Git:** Merged to main via PR #2

---

## Pending / TODO

- [x] Add price display to news cards (symbol price at time of news)
- [x] Integrate Finnhub `/news-sentiment` endpoint for bullish/bearish scores (used outcome-based instead)
- [x] Paper trading backend (db, Tauri commands, TypeScript API)
- [x] AI Trader guardrails & circuit breaker
- [ ] Paper trading frontend UI (sidebar panel)
- [ ] Guardrails mode switcher UI in AI Trader tab
- [ ] Ollama tool calling integration
- [ ] Vector learning hooks capturing KALIC tool executions

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| npm not found | `. "X:\dev\tools\kalic-path-hook.ps1"; Repair-PathForTool "npm"` |
| cargo not found | `Repair-PathForTool "cargo"` |
| devUrl wrong IP | Already fixed + skip-worktree applied |
| PhiSHRI wrong count | Restart Claude Desktop (config updated) |

| localhost:1420 refused | Run `npm run tauri dev` (starts Vite + Tauri together), OR `npm run build` first if using debug exe |
| Frontend not bundled | Use `npm run tauri build`, NOT just `cargo build --release` |


---

## [2026-01-21] npm.ps1 Wrapper Broken in PowerShell
**Author:** DC
**Files:** C:\Program Files\nodejs\npm.ps1
**Summary:** Node.js npm.ps1 wrapper script fails with $LASTEXITCODE not set error

- npm.ps1 line 17 and 50 reference $LASTEXITCODE before it's initialized
- Affects ALL pwsh sessions trying to run npm commands
- KALIC was stuck in rebuild loop hitting this wall
- **FIX:** Use cmd.exe shell instead of pwsh for npm/node commands

### ❌ ERROR: npm fails in PowerShell
**When:** Running 
pm run dev or any npm command in pwsh
**Fix:** Use cmd shell: cmd /c "npm run dev" OR create cmd-based terminal session
**Prevention:** KALIC should use cmd shells for Node.js projects, not pwsh


---

## [2026-01-21] KALIC Report & Log Analysis Toolkit
**Author:** DC
**Files:** `tools\kalic_*.py`, `tools\kalic_*.bat`, `knowledge\KALIC_*.md`
**Summary:** Complete PDF report generation and AI decision log analysis system

**Scripts (X:\dev\financial-pipeline-rs\tools\):**
- `kalic_log_analyzer.py` - Parses ai_decisions/*.jsonl, calculates metrics
- `kalic_report_regen_v2.py` - PDF generator with AI performance section
- `kalic_report_export.py` - Static snapshot PDF (data baked in)
- `kalic_full_report.bat` - One-click: analyzer + PDF + JSON export
- `kalic_regen.bat` / `kalic_export.bat` - Individual launchers

**Documentation (X:\dev\financial-pipeline-rs\knowledge\):**
- `KALIC_TOOLKIT_README.md` - Full toolkit documentation
- `KALIC_REPORTS_README.md` - Original report docs

**Features:**
- 3-page PDF: Portfolio, Projections/Risk, AI Performance
- Log analysis: action breakdown, confidence distribution, model stats
- Markdown digest generation for daily review
- JSON export for programmatic integration
- Reads live from logs/ai_decisions/*.jsonl and reports/ai_trader_report_*.md

**Dependency:** `pip install reportlab`


---

## 2026-01-27: Major Cleanup - Project Consolidation (KALIC)

### Problem Discovered
Two cloned projects (financial-pipeline-rs and carbyne-phinance) were cross-contaminated:
- carbyne-phinance code had hardcoded paths to financial-pipeline-rs
- Both tauri apps shared same dev port (localhost:1420)
- Running financial-pipeline-rs exe showed carbyne UI because carbyne's vite server was on 1420

### Root Cause: Shared Dev Port Architecture
```
VITE DEV SERVER (carbyne-phinance)
  └── localhost:1420
        ▲
        │ Both exes connect here
        │
  ┌─────┴─────┐
  │           │
financial-   carbyne-
pipeline-rs  phinance
exe          (no exe built)
```

The exe from financial-pipeline-rs + vite from carbyne = mixed UI.

### Cleanup Actions Taken

| Step | Action |
|------|--------|
| 1 | Deleted dead `carbyne-phinance/repo/` folder (stale clone) |
| 2 | Fixed 9 files with hardcoded paths → `carbyne-phinance/fp-tauri-dev` |
| 3 | Copied latest database (24.9MB) from financial-pipeline-rs |
| 4 | Created missing dirs: reports, logs/trading_sim_logs, tools |
| 5 | Copied missing features: audit_reports, mcp-cdp, tools, requirements.txt |
| 6 | Verified Rust build ✓ (compiles clean) |

### Files Modified (path fixes)
- examples/ai_trader_full_cycle.rs
- examples/ai_trader_live_test.rs
- examples/check_db_state.rs
- examples/fix_db.rs
- examples/init_ai_tables.rs
- examples/ollama_nvda_test.rs
- examples/update_ai_config.rs
- tauri-app/src-tauri/src/http_api.rs
- tauri-app/src-tauri/src/lib.rs

### Current State
- **carbyne-phinance/fp-tauri-dev**: Single source of truth
- **financial-pipeline-rs**: Kept as reference only (do not use)
- **Vite dev server**: Running from carbyne-phinance on port 1420

### TODO
- [ ] Build carbyne-phinance exe for standalone use
- [ ] Consider archiving/deleting financial-pipeline-rs after full verification

---

## 2026-01-27: UI Bug Fixes & Feature Enhancements (KALIC)

**Author:** KALIC
**Files:** `src-tauri/src/lib.rs`, `src/api.ts`, `src/views/Portfolio.tsx`, `src/views/Dashboard.tsx`, `src/views/Charts.tsx`, `src/views/Symbols.tsx`, `src/components/charts/TradingChart.tsx`, `src/components/layout/ActivityBar.tsx`, `src/styles/components.css`

### Bug Fixes

| Issue | Fix |
|-------|-----|
| **P&L showing 924% instead of ~2.46%** | Hardcoded $100k starting capital in `lib.rs:2352` and `api.ts:468,602` changed to $1M (matching DB default) |
| **Notification badge always showing "3"** | ActivityBar had hardcoded badge values - now fetches real triggered alert count and symbol count dynamically |
| **Charts: Timeframe buttons not working** | Added `filterByTimeframe()` function to `Charts.tsx` and `Dashboard.tsx` - filters data by 1D/1W/1M/3M/1Y/ALL |
| **Charts: Line/Area chart types broken** | TradingChart wasn't reinitializing on chartType change - added `reinitializeChart()` that removes and recreates chart on prop changes |
| **Charts: Volume toggle not working** | Same fix - tracked `prevShowVolume` and reinitialize chart when toggle changes |

### New Features

**1. Real-Time Portfolio Updates (10 second refresh)**
- `Portfolio.tsx`: Auto-refresh all portfolio data (balance, positions, trades, competition stats)
- `Dashboard.tsx`: Auto-refresh competition stats and balance
- Uses `onMount`/`onCleanup` lifecycle hooks with `setInterval`

**2. Stop-Loss / Take-Profit Price Alerts**
- Added `handleSetStopLoss(symbol, price)` - creates alert at 5% below current price
- Added `handleSetTakeProfit(symbol, price)` - creates alert at 15% above current price
- New Actions column in Positions table with SL/TP buttons

**3. Symbols & Watchlists - Bulk Add & Auto-Populate**
- **Checkboxes** for multi-select symbols with Select All
- **"Add X to Watchlist"** dropdown button when symbols are selected
- **"Auto-Populate Groups"** dropdown with predefined categories:
  - AI & Tech (15 stocks)
  - Semiconductors (15 stocks)
  - EV & Clean Energy (15 stocks)
  - Finance (15 stocks)
  - Healthcare (15 stocks)
  - Consumer (15 stocks)
  - Crypto-Related (10 stocks)
- Individual symbol **"Add to Watchlist"** dropdown per row
- CSS for bulk selection highlighting (`.bulk-selected` class)

### Code Changes Summary

```
lib.rs:        Fixed starting_capital: 100000.0 → 1_000_000.0
api.ts:        Fixed starting_capital: 100000 → 1000000 (2 locations)
Portfolio.tsx: Added 10s refresh + SL/TP handlers + Actions column
Dashboard.tsx: Added 10s refresh + timeframe filtering
Charts.tsx:    Added timeframe filtering
TradingChart:  Added reinitializeChart() for chartType/volume changes
ActivityBar:   Dynamic badges from API (alerts + symbols count)
Symbols.tsx:   Bulk selection + auto-populate + watchlist dropdowns
components.css: Dropdown improvements + bulk selection styles
```

---

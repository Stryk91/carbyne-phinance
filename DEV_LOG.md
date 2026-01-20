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

## Pending / TODO

- [x] Add price display to news cards (symbol price at time of news) ✅
- [x] Integrate Finnhub `/news-sentiment` endpoint for bullish/bearish scores ✅ (used outcome-based instead)
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


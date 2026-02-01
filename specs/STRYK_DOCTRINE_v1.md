# STRYK Doctrine - Competing Strategy Spec
## DC + STRYK vs KALIC + Worker

**Version:** 1.0
**Date:** 2026-01-21
**Authors:** DC (spec), STRYK (philosophy)
**Builder:** KALIC

---

## 1. Core Philosophy

> "In the bull market pump the dumps. In the bear market short the pumps."
> — STRYK, April 2023

This is not a signal-chasing system. This is a thesis-driven, regime-aware, patience-first system with exception triggers for asymmetric plays.

### The Difference

| Dimension | KALIC System | STRYK Doctrine |
|-----------|--------------|----------------|
| Entry trigger | Technical signal fires | Thesis validated + entry price reached |
| Research period | None (real-time) | Minimum 7 days on new positions |
| Cash reserve | 80% (too conservative) | 15-20% (opportunity fund only) |
| Position frequency | High (daily decisions) | Low (weekly/monthly) |
| Edge source | Indicator confluence | Regime + catalyst + institutional flow |
| Exit trigger | Signal reversal | Euphoria detection OR thesis invalidation |

---

## 2. Regime Detection

Before any trade, classify the current regime. Direction of trades depends on regime.

### Regime States

| Regime | Definition | Default Bias |
|--------|------------|--------------|
| BULL | 200 DMA rising, price above, Fear/Greed > 45 | Long dips |
| BEAR | 200 DMA falling, price below, Fear/Greed < 40 | Short pumps |
| CHOP | 200 DMA flat, price oscillating, Fear/Greed 35-55 | No new positions |
| CAPITULATION | Fear/Greed < 20, VIX > 35, -20% from recent high | ACCUMULATE |
| EUPHORIA | Fear/Greed > 80, VIX < 15, retail volume spike | DISTRIBUTE |

### Implementation
- Pull Fear & Greed Index daily (already in db: fear_greed_index table)
- 200 DMA calculated on SPY as market proxy
- VIX threshold monitoring
- Regime stored in db, logged on change

---

## 3. Catalyst Calendar

Hard-coded known events that historically move markets. These create setup windows.

### Crypto Catalysts
| Event | Typical Impact | Strategy |
|-------|----------------|----------|
| BTC Halving | Supply shock → 12-18 month bull run | Accumulate 6mo before, hold through |
| ETF Decisions | Binary volatility spike | Position before deadline if thesis strong |
| Major exchange listing | 20-50% pump then fade | Front-run if intel, avoid FOMO after |

### Macro Catalysts  
| Event | Frequency | Strategy |
|-------|-----------|----------|
| FOMC Rate Decision | 8x/year | No new positions 48hr before. Trade reaction, not prediction |
| CPI Release | Monthly | Volatility play if positioned, otherwise wait |
| Earnings Season | Quarterly | Stock-specific thesis required |
| Quad Witching | Quarterly | Expect chop, tighten stops |

### Sector Catalysts
| Event | Impact |
|-------|--------|
| AI model releases (GPT-5, Gemini, Claude) | NVDA, AMD, cloud providers pump |
| Chip export restrictions | Semis volatile, thesis-dependent |
| Regulatory announcements | Sector-wide repricing |

### Data Sources
- FRED API (already integrated)
- Finnhub earnings calendar
- Custom RSS feeds for crypto events
- Manual additions to catalyst_calendar table

---

## 4. Institutional Flow Tracking (Fat Cat Index)

> "If 75% of fat cats are buying in big, it's telling you something. Sometimes they're wrong and it still goes up from sheer capital injection."

### The Logic
Institutions move markets through capital weight, not accuracy. Track what they're DOING, not what they're SAYING.

### Data Sources

#### Stocks (13F Filings)
- SEC EDGAR 13F filings (quarterly, 45 day delay)
- Track: Berkshire, Bridgewater, Renaissance, Citadel, BlackRock, Vanguard
- Aggregate: % of tracked institutions increasing vs decreasing position

#### Crypto (On-Chain)
- Whale wallet tracking (wallets > 1000 BTC)
- Exchange inflow/outflow (Glassnode, CryptoQuant)
- Grayscale/ETF holdings changes

### Fat Cat Index Calculation

`
fat_cat_score = (institutions_buying - institutions_selling) / total_tracked

Ranges:
  > 0.75  = STRONG INSTITUTIONAL BID (bullish even if thesis unclear)
  > 0.50  = INSTITUTIONAL ACCUMULATION  
  > 0.25  = MIXED
  > 0.00  = NEUTRAL
  < 0.00  = INSTITUTIONAL DISTRIBUTION
  < -0.50 = STRONG INSTITUTIONAL EXIT (bearish even if price holding)
`

### Integration Rule
- Fat Cat Score > 0.75 + Our thesis aligned = FULL POSITION
- Fat Cat Score > 0.75 + No thesis = HALF POSITION (riding capital flow)
- Fat Cat Score < -0.50 = NO NEW LONGS regardless of signals

---

## 5. Thesis Validation Period

No impulse trades. Every new position requires documented thesis.

### Requirements Before Entry
1. **Minimum 7 days** of research/monitoring for new assets
2. **Written thesis** stored in db with:
   - Bull case (why it goes up)
   - Bear case (why it fails)
   - Catalyst (what triggers the move)
   - Invalidation (what proves us wrong)
   - Target (price objective)
   - Timeframe (when we expect resolution)
3. **Regime alignment** - thesis must fit current regime
4. **Asymmetry check** - must pass scoring (see below)

### Exception: Asymmetric Early-Stage Plays
AI IPOs, paradigm shifts, once-in-cycle entries bypass the 7-day rule IF:
- Downside is capped (position size limits risk)
- Upside is 5x+ potential
- DC + STRYK both agree (logged)

---

## 6. Asymmetry Scoring

Every potential trade scored on risk/reward asymmetry.

### Formula
`
asymmetry_score = (upside_potential / downside_risk) * conviction_multiplier

Where:
  upside_potential = target_price - entry_price
  downside_risk = entry_price - stop_loss (or entry_price if no stop)
  conviction_multiplier = 0.5 (low) | 1.0 (medium) | 1.5 (high)
`

### Thresholds
| Score | Action |
|-------|--------|
| < 2.0 | NO TRADE - risk/reward insufficient |
| 2.0 - 3.0 | SMALL POSITION (5% of portfolio) |
| 3.0 - 5.0 | STANDARD POSITION (10% of portfolio) |
| > 5.0 | CONVICTION POSITION (15% of portfolio max) |

### STRYK BTC Example (December 2022)
`
Entry: 17,500 AUD
Downside to zero: 17,500
Upside to 50% ATH reclaim (~50,000): 32,500
Conviction: HIGH (halving cycle, 6mo research)

asymmetry_score = (32,500 / 17,500) * 1.5 = 2.78

Reality: Went to 166,000 AUD
Actual asymmetry delivered: 9.5x
`

---

## 7. Entry Rules

### Standard Entry (Thesis-Driven)
1. Thesis documented and validated
2. Regime aligned (or exception granted)
3. Asymmetry score > 2.0
4. Fat Cat Index not contradicting
5. Entry price reached (patience - let it come to us)

### FOMO Blocker
**BLOCK BUY if ALL of these are true:**
- Price > 10% above 20-day MA
- Volume > 2x average (retail pile-in)
- Fear/Greed > 65
- Social mention velocity spiking

### Capitulation Entry (Aggressive Accumulation)
**ENABLE ACCUMULATION MODE if:**
- Fear/Greed < 25
- Asset > 30% below 52-week high
- Thesis still valid (fundamentals unchanged)
- Fat Cat Index not showing mass exodus

In this mode: DCA aggressively, ignore short-term signals

---

## 8. Exit Rules

### Profit Taking
- Scale out 25% at 2x
- Scale out 25% at 3x
- Let 50% ride with trailing stop

### Euphoria Exit
**SELL SIGNAL if ALL true:**
- Fear/Greed > 75
- Price > 30% above 200 DMA
- Retail volume spike
- "Everyone" talking about it (social velocity metric)
- Your Uber driver mentions it

### Thesis Invalidation
- If the reason you entered no longer applies, exit
- No ego, no hope, just exit
- Document why thesis failed for learning

### Time-Based Exit
- If thesis hasn't played out in expected timeframe + 50%, reassess
- Either extend with new thesis or close

---

## 9. Position Sizing & Portfolio Rules

### Allocation
| Category | Allocation |
|----------|------------|
| Deployed capital | 80-85% (-850K) |
| Opportunity reserve | 15-20% (-200K) |

### Position Limits
- Max single position: 15% of portfolio
- Max sector concentration: 40%
- Max correlated positions: 50% (e.g., all crypto, all semis)

### Reserve Usage
The 15-20% reserve is NOT for "safety" - it's for:
- Averaging into dips on existing positions
- Flash crash opportunities
- New thesis plays that appear mid-cycle

---

## 10. Logging & Accountability

Every decision logged with:
- Timestamp
- Asset
- Action (BUY/SELL/HOLD/PASS)
- Thesis summary
- Regime at time
- Fat Cat Index at time
- Asymmetry score
- DC reasoning
- STRYK input (if any)
- Outcome (filled later)

---

## 11. Comparison Metrics vs KALIC

Track these weekly:

| Metric | KALIC | STRYK Doctrine |
|--------|-------|----------------|
| Portfolio value | $ | $ |
| Total return % | | |
| Max drawdown % | | |
| Win rate | | |
| Average win size | | |
| Average loss size | | |
| Sharpe ratio | | |
| Number of trades | | |
| Average hold time | | |
| Cash % average | | |

### Expected Differences
- KALIC: More trades, smaller wins, tighter distribution
- STRYK: Fewer trades, larger wins when right, longer holds

---

## 12. Database Schema Additions

`sql
CREATE TABLE IF NOT EXISTS stryk_thesis (
    id INTEGER PRIMARY KEY,
    asset TEXT NOT NULL,
    created_at TEXT NOT NULL,
    bull_case TEXT,
    bear_case TEXT,
    catalyst TEXT,
    invalidation TEXT,
    target_price REAL,
    timeframe_days INTEGER,
    status TEXT DEFAULT 'active', -- active, executed, invalidated, expired
    outcome TEXT
);

CREATE TABLE IF NOT EXISTS stryk_trades (
    id INTEGER PRIMARY KEY,
    thesis_id INTEGER REFERENCES stryk_thesis(id),
    timestamp TEXT NOT NULL,
    asset TEXT NOT NULL,
    action TEXT NOT NULL, -- BUY, SELL, PASS
    quantity REAL,
    price REAL,
    regime TEXT,
    fat_cat_index REAL,
    asymmetry_score REAL,
    dc_reasoning TEXT,
    stryk_input TEXT
);

CREATE TABLE IF NOT EXISTS stryk_portfolio (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    cash REAL,
    positions_value REAL,
    total_value REAL
);

CREATE TABLE IF NOT EXISTS catalyst_calendar (
    id INTEGER PRIMARY KEY,
    event_name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_type TEXT, -- FOMC, HALVING, EARNINGS, ETF, etc.
    impact_assessment TEXT,
    affected_assets TEXT -- JSON array
);

CREATE TABLE IF NOT EXISTS fat_cat_tracking (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    asset TEXT NOT NULL,
    institution TEXT,
    action TEXT, -- INCREASE, DECREASE, NEW, EXIT
    size_change REAL,
    source TEXT -- 13F, on-chain, ETF flow
);
`

---

## 13. Implementation Priority

1. **Database schema** - Add tables above
2. **Regime detection module** - Fear/Greed + 200DMA + VIX
3. **Fat Cat Index** - Start with crypto whale tracking (free), add 13F later
4. **Thesis entry UI** - Form to log thesis before any trade
5. **Asymmetry calculator** - Auto-score on thesis entry
6. **FOMO blocker** - Hard block on entries matching criteria
7. **Comparison dashboard** - Side-by-side KALIC vs STRYK metrics

---

## 14. The Bet

,000,000 paper portfolio each.
Same starting date.
Same market conditions.
Different brains.

**KALIC:** Technical signals, AI-driven, high frequency
**STRYK+DC:** Thesis-driven, regime-aware, patience-first

6-month evaluation minimum. 

May the best system win.

---

*"Enter low and the rest takes care of itself."* — STRYK

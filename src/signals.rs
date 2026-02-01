//! Signal Generation Engine
//!
//! Detects trading signals from technical indicators

use crate::models::{
    ConfluenceConfig, ConfluenceSignal, DailyPrice, IndicatorVote, Signal, SignalDirection,
    SignalType, TechnicalIndicator,
};
use chrono::NaiveDate;
use std::collections::HashMap;

/// Configuration for signal detection thresholds
#[derive(Debug, Clone)]
pub struct SignalConfig {
    pub rsi_overbought: f64,
    pub rsi_oversold: f64,
    pub adx_strong_trend: f64,
    pub adx_weak_trend: f64,
    pub stoch_overbought: f64,
    pub stoch_oversold: f64,
    pub willr_overbought: f64,
    pub willr_oversold: f64,
    pub cci_overbought: f64,
    pub cci_oversold: f64,
    pub mfi_overbought: f64,
    pub mfi_oversold: f64,
}

impl Default for SignalConfig {
    fn default() -> Self {
        Self {
            rsi_overbought: 70.0,
            rsi_oversold: 30.0,
            adx_strong_trend: 25.0,
            adx_weak_trend: 20.0,
            stoch_overbought: 80.0,
            stoch_oversold: 20.0,
            willr_overbought: -20.0,
            willr_oversold: -80.0,
            cci_overbought: 100.0,
            cci_oversold: -100.0,
            mfi_overbought: 80.0,
            mfi_oversold: 20.0,
        }
    }
}

/// Main signal generator
pub struct SignalEngine {
    config: SignalConfig,
    confluence_config: ConfluenceConfig,
}

impl Default for SignalEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl SignalEngine {
    pub fn new() -> Self {
        Self {
            config: SignalConfig::default(),
            confluence_config: ConfluenceConfig::default(),
        }
    }

    pub fn with_config(config: SignalConfig) -> Self {
        Self {
            config,
            confluence_config: ConfluenceConfig::default(),
        }
    }

    pub fn with_confluence_config(mut self, confluence_config: ConfluenceConfig) -> Self {
        self.confluence_config = confluence_config;
        self
    }

    /// Build a map of indicators by date for O(1) lookups
    fn build_indicator_map(
        &self,
        indicators: &[TechnicalIndicator],
    ) -> HashMap<NaiveDate, HashMap<String, f64>> {
        let mut map: HashMap<NaiveDate, HashMap<String, f64>> = HashMap::new();

        for ind in indicators {
            map.entry(ind.date)
                .or_default()
                .insert(ind.indicator_name.clone(), ind.value);
        }

        map
    }

    /// Generate all signals from indicators for a symbol
    pub fn generate_signals(
        &self,
        symbol: &str,
        indicators: &[TechnicalIndicator],
        prices: &[DailyPrice],
    ) -> Vec<Signal> {
        if prices.is_empty() || indicators.is_empty() {
            return vec![];
        }

        let mut signals = Vec::new();
        let indicator_map = self.build_indicator_map(indicators);

        // Get sorted dates from prices
        let mut price_map: HashMap<NaiveDate, &DailyPrice> = HashMap::new();
        for price in prices {
            price_map.insert(price.date, price);
        }

        // Process each date
        let mut dates: Vec<_> = indicator_map.keys().copied().collect();
        dates.sort();

        for (i, date) in dates.iter().enumerate() {
            let Some(indicators_today) = indicator_map.get(date) else {
                continue;
            };
            let indicators_prev = if i > 0 {
                indicator_map.get(&dates[i - 1])
            } else {
                None
            };
            let price = price_map.get(date).map(|p| p.close).unwrap_or(0.0);

            // RSI signals
            if let Some(sig) =
                self.detect_rsi_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // MACD signals
            if let Some(sig) =
                self.detect_macd_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // Bollinger Band signals
            if let Some(sig) =
                self.detect_bollinger_signal(symbol, *date, price, indicators_today)
            {
                signals.push(sig);
            }

            // MA Crossover signals
            if let Some(sig) =
                self.detect_ma_crossover_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // ADX signals
            if let Some(sig) =
                self.detect_adx_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // Stochastic signals
            if let Some(sig) =
                self.detect_stochastic_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // Williams %R signals
            if let Some(sig) =
                self.detect_willr_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // CCI signals
            if let Some(sig) =
                self.detect_cci_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }

            // MFI signals
            if let Some(sig) =
                self.detect_mfi_signal(symbol, *date, price, indicators_today, indicators_prev)
            {
                signals.push(sig);
            }
        }

        signals
    }

    /// Detect RSI overbought/oversold signals
    fn detect_rsi_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let rsi = *today.get("RSI_14")?;
        let prev_rsi = prev.and_then(|p| p.get("RSI_14").copied());

        // Detect crossing into overbought
        if rsi > self.config.rsi_overbought {
            if prev_rsi.map_or(true, |p| p <= self.config.rsi_overbought) {
                let strength = ((rsi - self.config.rsi_overbought) / 30.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::RsiOverbought,
                    direction: SignalDirection::Bearish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "RSI_14".to_string(),
                    trigger_value: rsi,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }
        // Detect crossing into oversold
        else if rsi < self.config.rsi_oversold {
            if prev_rsi.map_or(true, |p| p >= self.config.rsi_oversold) {
                let strength = ((self.config.rsi_oversold - rsi) / 30.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::RsiOversold,
                    direction: SignalDirection::Bullish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "RSI_14".to_string(),
                    trigger_value: rsi,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }

        None
    }

    /// Detect MACD crossover signals
    fn detect_macd_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let macd = *today.get("MACD_12_26")?;
        let signal = *today.get("MACD_SIGNAL_9")?;
        let prev_macd = prev.and_then(|p| p.get("MACD_12_26").copied())?;
        let prev_signal = prev.and_then(|p| p.get("MACD_SIGNAL_9").copied())?;

        // Bullish crossover: MACD crosses above signal
        if prev_macd <= prev_signal && macd > signal {
            let strength = ((macd - signal).abs() / price.max(1.0) * 100.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::MacdBullishCross,
                direction: SignalDirection::Bullish,
                strength,
                price_at_signal: price,
                triggered_by: "MACD".to_string(),
                trigger_value: macd,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }
        // Bearish crossover: MACD crosses below signal
        else if prev_macd >= prev_signal && macd < signal {
            let strength = ((macd - signal).abs() / price.max(1.0) * 100.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::MacdBearishCross,
                direction: SignalDirection::Bearish,
                strength,
                price_at_signal: price,
                triggered_by: "MACD".to_string(),
                trigger_value: macd,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }

        None
    }

    /// Detect Bollinger Band breakout signals
    fn detect_bollinger_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
    ) -> Option<Signal> {
        let upper = *today.get("BB_UPPER_20")?;
        let lower = *today.get("BB_LOWER_20")?;
        let middle = *today.get("BB_MIDDLE_20")?;

        // Price breaks above upper band (overbought/potential breakout)
        if price > upper {
            let strength = ((price - upper) / (upper - middle).max(0.01)).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::BollingerUpperBreak,
                direction: SignalDirection::Bearish, // Often signals reversal
                strength,
                price_at_signal: price,
                triggered_by: "BB_UPPER_20".to_string(),
                trigger_value: upper,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }
        // Price breaks below lower band (oversold/potential bounce)
        else if price < lower {
            let strength = ((lower - price) / (middle - lower).max(0.01)).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::BollingerLowerBreak,
                direction: SignalDirection::Bullish, // Often signals bounce
                strength,
                price_at_signal: price,
                triggered_by: "BB_LOWER_20".to_string(),
                trigger_value: lower,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }

        None
    }

    /// Detect MA crossover signals (SMA 20/50)
    fn detect_ma_crossover_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let sma_fast = *today.get("SMA_20")?;
        let sma_slow = *today.get("SMA_50")?;
        let prev_fast = prev.and_then(|p| p.get("SMA_20").copied())?;
        let prev_slow = prev.and_then(|p| p.get("SMA_50").copied())?;

        // Golden cross: fast MA crosses above slow MA
        if prev_fast <= prev_slow && sma_fast > sma_slow {
            let strength = ((sma_fast - sma_slow) / sma_slow * 100.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::MaCrossoverBullish,
                direction: SignalDirection::Bullish,
                strength,
                price_at_signal: price,
                triggered_by: "SMA_20/50".to_string(),
                trigger_value: sma_fast,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }
        // Death cross: fast MA crosses below slow MA
        else if prev_fast >= prev_slow && sma_fast < sma_slow {
            let strength = ((sma_slow - sma_fast) / sma_slow * 100.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::MaCrossoverBearish,
                direction: SignalDirection::Bearish,
                strength,
                price_at_signal: price,
                triggered_by: "SMA_20/50".to_string(),
                trigger_value: sma_fast,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }

        None
    }

    /// Detect ADX trend strength signals
    fn detect_adx_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let adx = *today.get("ADX_14")?;
        let prev_adx = prev.and_then(|p| p.get("ADX_14").copied());

        // Trend strengthening: ADX crosses above 25
        if adx > self.config.adx_strong_trend {
            if prev_adx.map_or(true, |p| p <= self.config.adx_strong_trend) {
                let strength = ((adx - self.config.adx_strong_trend) / 25.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::AdxTrendStrong,
                    direction: SignalDirection::Neutral, // ADX doesn't indicate direction
                    strength,
                    price_at_signal: price,
                    triggered_by: "ADX_14".to_string(),
                    trigger_value: adx,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }
        // Trend weakening: ADX crosses below 20
        else if adx < self.config.adx_weak_trend {
            if prev_adx.map_or(true, |p| p >= self.config.adx_weak_trend) {
                let strength = ((self.config.adx_weak_trend - adx) / 20.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::AdxTrendWeak,
                    direction: SignalDirection::Neutral,
                    strength,
                    price_at_signal: price,
                    triggered_by: "ADX_14".to_string(),
                    trigger_value: adx,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }

        None
    }

    /// Detect Stochastic crossover signals
    fn detect_stochastic_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let k = *today.get("STOCH_K_14")?;
        let d = *today.get("STOCH_D_3")?;
        let prev_k = prev.and_then(|p| p.get("STOCH_K_14").copied())?;
        let prev_d = prev.and_then(|p| p.get("STOCH_D_3").copied())?;

        // Bullish crossover from oversold
        if prev_k <= prev_d && k > d && k < self.config.stoch_oversold + 20.0 {
            let strength = ((d - k).abs() / 20.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::StochBullishCross,
                direction: SignalDirection::Bullish,
                strength,
                price_at_signal: price,
                triggered_by: "STOCH".to_string(),
                trigger_value: k,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }
        // Bearish crossover from overbought
        else if prev_k >= prev_d && k < d && k > self.config.stoch_overbought - 20.0 {
            let strength = ((k - d).abs() / 20.0).min(1.0);
            return Some(Signal {
                id: 0,
                symbol: symbol.to_string(),
                signal_type: SignalType::StochBearishCross,
                direction: SignalDirection::Bearish,
                strength,
                price_at_signal: price,
                triggered_by: "STOCH".to_string(),
                trigger_value: k,
                timestamp: date,
                created_at: String::new(),
                acknowledged: false,
            });
        }

        None
    }

    /// Detect Williams %R signals
    fn detect_willr_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let willr = *today.get("WILLR_14")?;
        let prev_willr = prev.and_then(|p| p.get("WILLR_14").copied());

        // Overbought (Williams %R > -20)
        if willr > self.config.willr_overbought {
            if prev_willr.map_or(true, |p| p <= self.config.willr_overbought) {
                let strength = ((willr - self.config.willr_overbought) / 20.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::WillrOverbought,
                    direction: SignalDirection::Bearish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "WILLR_14".to_string(),
                    trigger_value: willr,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }
        // Oversold (Williams %R < -80)
        else if willr < self.config.willr_oversold {
            if prev_willr.map_or(true, |p| p >= self.config.willr_oversold) {
                let strength = ((self.config.willr_oversold - willr) / 20.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::WillrOversold,
                    direction: SignalDirection::Bullish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "WILLR_14".to_string(),
                    trigger_value: willr,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }

        None
    }

    /// Detect CCI signals
    fn detect_cci_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let cci = *today.get("CCI_20")?;
        let prev_cci = prev.and_then(|p| p.get("CCI_20").copied());

        // Overbought (CCI > 100)
        if cci > self.config.cci_overbought {
            if prev_cci.map_or(true, |p| p <= self.config.cci_overbought) {
                let strength = ((cci - self.config.cci_overbought) / 100.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::CciOverbought,
                    direction: SignalDirection::Bearish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "CCI_20".to_string(),
                    trigger_value: cci,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }
        // Oversold (CCI < -100)
        else if cci < self.config.cci_oversold {
            if prev_cci.map_or(true, |p| p >= self.config.cci_oversold) {
                let strength = ((self.config.cci_oversold - cci) / 100.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::CciOversold,
                    direction: SignalDirection::Bullish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "CCI_20".to_string(),
                    trigger_value: cci,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }

        None
    }

    /// Detect MFI signals
    fn detect_mfi_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        today: &HashMap<String, f64>,
        prev: Option<&HashMap<String, f64>>,
    ) -> Option<Signal> {
        let mfi = *today.get("MFI_14")?;
        let prev_mfi = prev.and_then(|p| p.get("MFI_14").copied());

        // Overbought (MFI > 80)
        if mfi > self.config.mfi_overbought {
            if prev_mfi.map_or(true, |p| p <= self.config.mfi_overbought) {
                let strength = ((mfi - self.config.mfi_overbought) / 20.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::MfiOverbought,
                    direction: SignalDirection::Bearish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "MFI_14".to_string(),
                    trigger_value: mfi,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }
        // Oversold (MFI < 20)
        else if mfi < self.config.mfi_oversold {
            if prev_mfi.map_or(true, |p| p >= self.config.mfi_oversold) {
                let strength = ((self.config.mfi_oversold - mfi) / 20.0).min(1.0);
                return Some(Signal {
                    id: 0,
                    symbol: symbol.to_string(),
                    signal_type: SignalType::MfiOversold,
                    direction: SignalDirection::Bullish,
                    strength,
                    price_at_signal: price,
                    triggered_by: "MFI_14".to_string(),
                    trigger_value: mfi,
                    timestamp: date,
                    created_at: String::new(),
                    acknowledged: false,
                });
            }
        }

        None
    }

    // ========================================================================
    // Confluence Signal Detection
    // ========================================================================

    /// Detect confluence signal when 3+ indicators agree on direction
    /// Returns ConfluenceSignal if enough indicators agree, None otherwise
    pub fn detect_confluence_signal(
        &self,
        symbol: &str,
        date: NaiveDate,
        price: f64,
        indicators: &HashMap<String, f64>,
    ) -> Option<ConfluenceSignal> {
        let mut votes: Vec<IndicatorVote> = Vec::new();
        let mut bullish_count = 0usize;
        let mut bearish_count = 0usize;
        let mut bullish_strength_sum = 0.0f64;
        let mut bearish_strength_sum = 0.0f64;

        // RSI vote
        if let Some(&rsi) = indicators.get("RSI_14") {
            if rsi < self.confluence_config.rsi_oversold {
                let strength = ((self.confluence_config.rsi_oversold - rsi) / 30.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "RSI_14".to_string(),
                    direction: SignalDirection::Bullish,
                    strength,
                    value: rsi,
                });
                bullish_count += 1;
                bullish_strength_sum += strength;
            } else if rsi > self.confluence_config.rsi_overbought {
                let strength = ((rsi - self.confluence_config.rsi_overbought) / 30.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "RSI_14".to_string(),
                    direction: SignalDirection::Bearish,
                    strength,
                    value: rsi,
                });
                bearish_count += 1;
                bearish_strength_sum += strength;
            }
        }

        // MACD vote (bullish if MACD > Signal, bearish if MACD < Signal)
        if let (Some(&macd), Some(&signal)) = (
            indicators.get("MACD_12_26"),
            indicators.get("MACD_SIGNAL_9"),
        ) {
            let diff = macd - signal;
            if diff > 0.0 {
                let strength = (diff.abs() / price.max(1.0) * 100.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "MACD".to_string(),
                    direction: SignalDirection::Bullish,
                    strength,
                    value: macd,
                });
                bullish_count += 1;
                bullish_strength_sum += strength;
            } else if diff < 0.0 {
                let strength = (diff.abs() / price.max(1.0) * 100.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "MACD".to_string(),
                    direction: SignalDirection::Bearish,
                    strength,
                    value: macd,
                });
                bearish_count += 1;
                bearish_strength_sum += strength;
            }
        }

        // Bollinger Bands vote (price vs bands)
        if let (Some(&upper), Some(&lower)) = (
            indicators.get("BB_UPPER_20"),
            indicators.get("BB_LOWER_20"),
        ) {
            if price < lower {
                let middle = (upper + lower) / 2.0;
                let strength = ((lower - price) / (middle - lower).max(0.01)).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "BB_LOWER".to_string(),
                    direction: SignalDirection::Bullish,
                    strength,
                    value: price,
                });
                bullish_count += 1;
                bullish_strength_sum += strength;
            } else if price > upper {
                let middle = (upper + lower) / 2.0;
                let strength = ((price - upper) / (upper - middle).max(0.01)).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "BB_UPPER".to_string(),
                    direction: SignalDirection::Bearish,
                    strength,
                    value: price,
                });
                bearish_count += 1;
                bearish_strength_sum += strength;
            }
        }

        // Stochastic vote
        if let Some(&stoch_k) = indicators.get("STOCH_K_14") {
            if stoch_k < self.confluence_config.stoch_oversold {
                let strength =
                    ((self.confluence_config.stoch_oversold - stoch_k) / 20.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "STOCH_K".to_string(),
                    direction: SignalDirection::Bullish,
                    strength,
                    value: stoch_k,
                });
                bullish_count += 1;
                bullish_strength_sum += strength;
            } else if stoch_k > self.confluence_config.stoch_overbought {
                let strength =
                    ((stoch_k - self.confluence_config.stoch_overbought) / 20.0).min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "STOCH_K".to_string(),
                    direction: SignalDirection::Bearish,
                    strength,
                    value: stoch_k,
                });
                bearish_count += 1;
                bearish_strength_sum += strength;
            }
        }

        // CCI vote
        if let Some(&cci) = indicators.get("CCI_20") {
            if cci < self.confluence_config.cci_oversold {
                let strength =
                    ((self.confluence_config.cci_oversold - cci) / 100.0).abs().min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "CCI_20".to_string(),
                    direction: SignalDirection::Bullish,
                    strength,
                    value: cci,
                });
                bullish_count += 1;
                bullish_strength_sum += strength;
            } else if cci > self.confluence_config.cci_overbought {
                let strength =
                    ((cci - self.confluence_config.cci_overbought) / 100.0).abs().min(1.0);
                votes.push(IndicatorVote {
                    indicator_name: "CCI_20".to_string(),
                    direction: SignalDirection::Bearish,
                    strength,
                    value: cci,
                });
                bearish_count += 1;
                bearish_strength_sum += strength;
            }
        }

        // ADX - confidence multiplier (doesn't vote on direction)
        let adx_confidence = indicators.get("ADX_14").copied().filter(|&adx| {
            adx > self.confluence_config.adx_strong_trend
        });

        // Determine if we have confluence
        let min_required = self.confluence_config.min_agreeing_indicators;

        let (direction, base_strength) = if bullish_count >= min_required {
            let avg_strength = bullish_strength_sum / bullish_count as f64;
            (SignalDirection::Bullish, avg_strength)
        } else if bearish_count >= min_required {
            let avg_strength = bearish_strength_sum / bearish_count as f64;
            (SignalDirection::Bearish, avg_strength)
        } else {
            return None; // Not enough agreement
        };

        // Apply ADX confidence multiplier (cap at 2x)
        let final_strength = if let Some(adx) = adx_confidence {
            (base_strength * (adx / 25.0).min(2.0)).min(1.0)
        } else {
            base_strength
        };

        Some(ConfluenceSignal {
            id: 0,
            symbol: symbol.to_string(),
            date,
            direction,
            strength: final_strength,
            contributing_indicators: votes,
            bullish_count,
            bearish_count,
            adx_confidence,
            price_at_signal: price,
            created_at: String::new(),
        })
    }

    /// Generate all signals including confluence signals for a symbol
    pub fn generate_signals_with_confluence(
        &self,
        symbol: &str,
        indicators: &[TechnicalIndicator],
        prices: &[DailyPrice],
    ) -> (Vec<Signal>, Vec<ConfluenceSignal>) {
        let individual_signals = self.generate_signals(symbol, indicators, prices);
        let indicator_map = self.build_indicator_map(indicators);

        let mut confluence_signals = Vec::new();

        // Build price map
        let price_map: HashMap<NaiveDate, f64> = prices
            .iter()
            .map(|p| (p.date, p.close))
            .collect();

        // Check for confluence on each date
        for (date, day_indicators) in &indicator_map {
            let price = price_map.get(date).copied().unwrap_or(0.0);
            if let Some(confluence) =
                self.detect_confluence_signal(symbol, *date, price, day_indicators)
            {
                confluence_signals.push(confluence);
            }
        }

        (individual_signals, confluence_signals)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn test_detect_confluence_bullish() {
        let engine = SignalEngine::new();
        let date = NaiveDate::from_ymd_opt(2026, 1, 21).unwrap();

        // Mock indicators that should trigger bullish confluence (4 bullish signals)
        let mut indicators = HashMap::new();
        indicators.insert("RSI_14".to_string(), 25.0); // Below 30 = Bullish
        indicators.insert("MACD_12_26".to_string(), 1.5); // MACD > Signal = Bullish
        indicators.insert("MACD_SIGNAL_9".to_string(), 1.0);
        indicators.insert("STOCH_K_14".to_string(), 15.0); // Below 20 = Bullish
        indicators.insert("CCI_20".to_string(), -150.0); // Below -100 = Bullish
        indicators.insert("BB_UPPER_20".to_string(), 110.0);
        indicators.insert("BB_LOWER_20".to_string(), 90.0);
        indicators.insert("ADX_14".to_string(), 30.0); // Strong trend

        let price = 95.0; // Below BB_LOWER, adds 5th bullish vote

        let result = engine.detect_confluence_signal("AAPL", date, price, &indicators);

        assert!(result.is_some(), "Confluence should fire with 5 bullish indicators");
        let confluence = result.unwrap();
        assert_eq!(confluence.direction, SignalDirection::Bullish);
        assert!(confluence.strength > 0.0, "Strength should be positive");
        assert!(confluence.bullish_count >= 3, "Should have at least 3 bullish votes");
        assert!(confluence.adx_confidence.is_some(), "ADX > 25 should provide confidence");
        assert_eq!(confluence.symbol, "AAPL");
    }

    #[test]
    fn test_detect_confluence_bearish() {
        let engine = SignalEngine::new();
        let date = NaiveDate::from_ymd_opt(2026, 1, 21).unwrap();

        // Mock indicators that should trigger bearish confluence
        let mut indicators = HashMap::new();
        indicators.insert("RSI_14".to_string(), 80.0); // Above 70 = Bearish
        indicators.insert("MACD_12_26".to_string(), 0.5); // MACD < Signal = Bearish
        indicators.insert("MACD_SIGNAL_9".to_string(), 1.0);
        indicators.insert("STOCH_K_14".to_string(), 85.0); // Above 80 = Bearish
        indicators.insert("CCI_20".to_string(), 150.0); // Above 100 = Bearish
        indicators.insert("BB_UPPER_20".to_string(), 100.0);
        indicators.insert("BB_LOWER_20".to_string(), 80.0);

        let price = 105.0; // Above BB_UPPER = Bearish

        let result = engine.detect_confluence_signal("TSLA", date, price, &indicators);

        assert!(result.is_some(), "Confluence should fire with bearish indicators");
        let confluence = result.unwrap();
        assert_eq!(confluence.direction, SignalDirection::Bearish);
        assert!(confluence.bearish_count >= 3, "Should have at least 3 bearish votes");
    }

    #[test]
    fn test_detect_confluence_insufficient_agreement() {
        let engine = SignalEngine::new();
        let date = NaiveDate::from_ymd_opt(2026, 1, 21).unwrap();

        // Mixed signals - only 2 bullish, 1 bearish = no confluence
        let mut indicators = HashMap::new();
        indicators.insert("RSI_14".to_string(), 25.0); // Bullish
        indicators.insert("MACD_12_26".to_string(), 0.5); // Bearish (MACD < Signal)
        indicators.insert("MACD_SIGNAL_9".to_string(), 1.0);
        indicators.insert("STOCH_K_14".to_string(), 15.0); // Bullish
        indicators.insert("CCI_20".to_string(), 50.0); // Neutral (between -100 and 100)
        indicators.insert("BB_UPPER_20".to_string(), 110.0);
        indicators.insert("BB_LOWER_20".to_string(), 90.0);

        let price = 100.0; // Neutral (within bands)

        let result = engine.detect_confluence_signal("MSFT", date, price, &indicators);

        assert!(result.is_none(), "Confluence should NOT fire with only 2 agreeing indicators");
    }

    #[test]
    fn test_confluence_adx_multiplier() {
        let engine = SignalEngine::new();
        let date = NaiveDate::from_ymd_opt(2026, 1, 21).unwrap();

        // Same bullish setup, test with and without strong ADX
        let mut indicators_weak_adx = HashMap::new();
        indicators_weak_adx.insert("RSI_14".to_string(), 25.0);
        indicators_weak_adx.insert("MACD_12_26".to_string(), 1.5);
        indicators_weak_adx.insert("MACD_SIGNAL_9".to_string(), 1.0);
        indicators_weak_adx.insert("STOCH_K_14".to_string(), 15.0);
        indicators_weak_adx.insert("CCI_20".to_string(), -150.0);
        indicators_weak_adx.insert("ADX_14".to_string(), 15.0); // Weak trend

        let mut indicators_strong_adx = indicators_weak_adx.clone();
        indicators_strong_adx.insert("ADX_14".to_string(), 40.0); // Strong trend

        let price = 100.0;

        let result_weak = engine.detect_confluence_signal("TEST", date, price, &indicators_weak_adx);
        let result_strong = engine.detect_confluence_signal("TEST", date, price, &indicators_strong_adx);

        assert!(result_weak.is_some());
        assert!(result_strong.is_some());

        let weak = result_weak.unwrap();
        let strong = result_strong.unwrap();

        assert!(weak.adx_confidence.is_none(), "Weak ADX should not provide confidence");
        assert!(strong.adx_confidence.is_some(), "Strong ADX should provide confidence");
        assert!(
            strong.strength >= weak.strength,
            "Strong ADX should boost strength"
        );
    }
}

// Finnhub API integration for financial news
// Fetches company news and market data from Finnhub

use anyhow::{anyhow, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use chrono::{NaiveDate, Utc};

const FINNHUB_API_URL: &str = "https://finnhub.io/api/v1";

/// News item from Finnhub API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsItem {
    /// Category (company, general, forex, crypto, merger)
    pub category: String,
    /// Unix timestamp in seconds
    pub datetime: i64,
    /// News headline
    pub headline: String,
    /// Finnhub news ID
    pub id: i64,
    /// Thumbnail image URL
    pub image: Option<String>,
    /// Related stock symbols
    pub related: String,
    /// News source (e.g., "Yahoo", "Reuters")
    pub source: String,
    /// Short summary of the article
    pub summary: String,
    /// Full article URL
    pub url: String,
}

/// Simplified news item for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleNewsItem {
    pub headline: String,
    pub summary: String,
    pub source: String,
    pub url: String,
    pub date: String,
    pub symbol: String,
}

/// Stock quote from Finnhub /quote endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    /// Current price
    #[serde(rename = "c")]
    pub current: f64,
    /// Change
    #[serde(rename = "d")]
    pub change: Option<f64>,
    /// Percent change
    #[serde(rename = "dp")]
    pub percent_change: Option<f64>,
    /// High price of the day
    #[serde(rename = "h")]
    pub high: f64,
    /// Low price of the day
    #[serde(rename = "l")]
    pub low: f64,
    /// Open price of the day
    #[serde(rename = "o")]
    pub open: f64,
    /// Previous close price
    #[serde(rename = "pc")]
    pub previous_close: f64,
    /// Unix timestamp
    #[serde(rename = "t")]
    pub timestamp: i64,
}

/// OHLCV candle data from Finnhub /stock/candle endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candles {
    /// Close prices
    #[serde(rename = "c", default)]
    pub close: Vec<f64>,
    /// High prices
    #[serde(rename = "h", default)]
    pub high: Vec<f64>,
    /// Low prices
    #[serde(rename = "l", default)]
    pub low: Vec<f64>,
    /// Open prices
    #[serde(rename = "o", default)]
    pub open: Vec<f64>,
    /// Volume
    #[serde(rename = "v", default)]
    pub volume: Vec<i64>,
    /// Unix timestamps
    #[serde(rename = "t", default)]
    pub timestamp: Vec<i64>,
    /// Status: "ok" or "no_data"
    #[serde(rename = "s")]
    pub status: String,
}

/// Price pattern data calculated from candles around an event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceReaction {
    pub symbol: String,
    pub event_date: String,
    pub start_date: String,
    pub end_date: String,
    pub pre_price: f64,
    pub post_price: f64,
    pub price_change_percent: f64,
    pub volume_change_percent: f64,
    pub candle_count: usize,
}

/// Finnhub API client
pub struct FinnhubClient {
    client: Client,
    api_key: String,
}

impl FinnhubClient {
    /// Create a new Finnhub client with the given API key
    pub fn new(api_key: String) -> Result<Self> {
        if api_key.is_empty() {
            return Err(anyhow!("Finnhub API key is required. Get one free at https://finnhub.io"));
        }

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self { client, api_key })
    }

    /// Fetch company news for a symbol
    /// Returns news from the last 7 days by default
    pub fn fetch_company_news(&self, symbol: &str) -> Result<Vec<NewsItem>> {
        self.fetch_company_news_range(symbol, None, None)
    }

    /// Fetch company news for a symbol within a date range
    pub fn fetch_company_news_range(
        &self,
        symbol: &str,
        from: Option<NaiveDate>,
        to: Option<NaiveDate>,
    ) -> Result<Vec<NewsItem>> {
        let today = Utc::now().date_naive();
        let to_date = to.unwrap_or(today);
        let from_date = from.unwrap_or_else(|| today - chrono::Duration::days(7));

        let url = format!(
            "{}/company-news?symbol={}&from={}&to={}&token={}",
            FINNHUB_API_URL,
            symbol.to_uppercase(),
            from_date.format("%Y-%m-%d"),
            to_date.format("%Y-%m-%d"),
            self.api_key
        );

        let response = self.client.get(&url).send()?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(anyhow!(
                "Finnhub API error: {} - {}",
                status,
                body
            ));
        }

        let news: Vec<NewsItem> = response.json()?;
        Ok(news)
    }

    /// Fetch news and convert to simple format for the frontend
    pub fn fetch_simple_news(&self, symbol: &str, limit: usize) -> Result<Vec<SimpleNewsItem>> {
        let news = self.fetch_company_news(symbol)?;

        let simple_news: Vec<SimpleNewsItem> = news
            .into_iter()
            .take(limit)
            .map(|item| {
                // Convert Unix timestamp to date string
                let datetime = chrono::DateTime::from_timestamp(item.datetime, 0)
                    .map(|dt| dt.format("%Y-%m-%d").to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                SimpleNewsItem {
                    headline: item.headline,
                    summary: item.summary,
                    source: item.source,
                    url: item.url,
                    date: datetime,
                    symbol: symbol.to_uppercase(),
                }
            })
            .collect();

        Ok(simple_news)
    }

    /// Fetch current quote for a symbol
    /// GET /quote?symbol=X&token=Y
    pub fn fetch_quote(&self, symbol: &str) -> Result<Quote> {
        let url = format!(
            "{}/quote?symbol={}&token={}",
            FINNHUB_API_URL,
            symbol.to_uppercase(),
            self.api_key
        );

        let response = self.client.get(&url).send()?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(anyhow!("Finnhub quote error: {} - {}", status, body));
        }

        let quote: Quote = response.json()?;
        Ok(quote)
    }

    /// Fetch OHLCV candles for a symbol
    /// GET /stock/candle?symbol=X&resolution=D&from=T1&to=T2&token=Y
    /// resolution: 1, 5, 15, 30, 60, D, W, M
    pub fn fetch_candles(&self, symbol: &str, resolution: &str, from: i64, to: i64) -> Result<Candles> {
        let url = format!(
            "{}/stock/candle?symbol={}&resolution={}&from={}&to={}&token={}",
            FINNHUB_API_URL,
            symbol.to_uppercase(),
            resolution,
            from,
            to,
            self.api_key
        );

        let response = self.client.get(&url).send()?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(anyhow!("Finnhub candle error: {} - {}", status, body));
        }

        let candles: Candles = response.json()?;

        if candles.status == "no_data" {
            return Err(anyhow!("No candle data available for {} in the specified range", symbol));
        }

        Ok(candles)
    }

    /// Fetch candles around an event date and calculate price reaction
    /// Returns price change from 3 days before to 3 days after the event
    pub fn fetch_price_reaction(&self, symbol: &str, event_date: &str, days_window: i64) -> Result<PriceReaction> {
        let date = NaiveDate::parse_from_str(event_date, "%Y-%m-%d")
            .map_err(|e| anyhow!("Invalid date format: {}", e))?;

        let start_date = date - chrono::Duration::days(days_window);
        let end_date = date + chrono::Duration::days(days_window);

        // Convert to Unix timestamps (start of day and end of day)
        let from_ts = start_date.and_hms_opt(0, 0, 0)
            .ok_or_else(|| anyhow!("Failed to create start timestamp"))?
            .and_utc()
            .timestamp();
        let to_ts = end_date.and_hms_opt(23, 59, 59)
            .ok_or_else(|| anyhow!("Failed to create end timestamp"))?
            .and_utc()
            .timestamp();

        let candles = self.fetch_candles(symbol, "D", from_ts, to_ts)?;

        if candles.close.is_empty() {
            return Err(anyhow!("No price data available for {} around {}", symbol, event_date));
        }

        // Get first and last prices
        let pre_price = *candles.close.first().unwrap();
        let post_price = *candles.close.last().unwrap();
        let price_change_percent = ((post_price - pre_price) / pre_price) * 100.0;

        // Calculate volume change if available
        let volume_change_percent = if candles.volume.len() >= 2 {
            let pre_vol = *candles.volume.first().unwrap() as f64;
            let post_vol = *candles.volume.last().unwrap() as f64;
            if pre_vol > 0.0 {
                ((post_vol - pre_vol) / pre_vol) * 100.0
            } else {
                0.0
            }
        } else {
            0.0
        };

        Ok(PriceReaction {
            symbol: symbol.to_uppercase(),
            event_date: event_date.to_string(),
            start_date: start_date.format("%Y-%m-%d").to_string(),
            end_date: end_date.format("%Y-%m-%d").to_string(),
            pre_price,
            post_price,
            price_change_percent,
            volume_change_percent,
            candle_count: candles.close.len(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires API key
    fn test_fetch_news() {
        let api_key = std::env::var("FINNHUB_API_KEY").unwrap();
        let client = FinnhubClient::new(api_key).unwrap();
        let news = client.fetch_company_news("AAPL").unwrap();
        assert!(!news.is_empty());
    }
}

// Tauri API wrapper with HTTP fallback for browser access

import { invoke } from '@tauri-apps/api/core';
import { addLog, addOutput, addProblem } from './components/layout/Panel';

// Detect if running in Tauri or browser
const isTauri = (): boolean => '__TAURI__' in window;

// HTTP API base URL (Tauri app runs server on port 3001)
const API_BASE = `http://${window.location.hostname}:3001`;

// Generic HTTP fetch helper
async function httpGet<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    return response.json();
}

// Types matching Rust structs
export interface SymbolPrice {
    symbol: string;
    price: number;
    change_percent: number;
    change_direction: string;
    favorited: boolean;
}

export interface CommandResult {
    success: boolean;
    message: string;
}

export interface IndicatorData {
    name: string;
    value: number;
    date: string;
}

export interface PriceData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MacroData {
    indicator: string;
    value: number;
    date: string;
    source: string;
}

export interface Alert {
    id: number;
    symbol: string;
    target_price: number;
    condition: string;
    triggered: boolean;
}

export interface Position {
    id: number;
    symbol: string;
    quantity: number;
    price: number;
    position_type: string;
    date: string;
    current_price: number;
    current_value: number;
    profit_loss: number;
    profit_loss_percent: number;
}

export interface Portfolio {
    positions: Position[];
    total_value: number;
    total_profit_loss: number;
    total_profit_loss_percent: number;
}

// API functions
let lastSymbolFetchTime = 0;
export async function getSymbols(): Promise<SymbolPrice[]> {
    const now = Date.now();
    const result = isTauri() ? await invoke<SymbolPrice[]>('get_symbols') : await httpGet<SymbolPrice[]>('/api/symbols');
    // Log only every 30 seconds to avoid spam
    if (now - lastSymbolFetchTime > 30000) {
        lastSymbolFetchTime = now;
        addOutput('Market Data', `Loaded ${result.length} symbols`);
    }
    return result;
}

export async function toggleFavorite(symbol: string): Promise<boolean> {
    return invoke('toggle_favorite', { symbol });
}

export async function getFavoritedSymbols(): Promise<string[]> {
    if (!isTauri()) return httpGet('/api/favorited');
    return invoke('get_favorited_symbols');
}

// Favorite all DC position symbols for auto-refresh
export async function favoriteDcPositions(): Promise<CommandResult> {
    return invoke('favorite_dc_positions');
}

// Favorite all KALIC position symbols for auto-refresh
export async function favoritePaperPositions(): Promise<CommandResult> {
    return invoke('favorite_paper_positions');
}

export async function fetchPrices(symbols: string, period: string): Promise<CommandResult> {
    const symbolList = symbols.split(',').map(s => s.trim()).filter(s => s);
    addLog(`[MARKET] Fetching ${symbolList.length} symbol(s): ${symbols}`, 'command');
    try {
        const result = await invoke<CommandResult>('fetch_prices', { symbols, period });
        addOutput('Market Data', `Fetched prices for ${symbolList.length} symbol(s)`);
        return result;
    } catch (err) {
        addLog(`[MARKET] Fetch failed: ${err}`, 'error');
        addProblem('warning', `Price fetch failed: ${err}`, 'Yahoo Finance');
        throw err;
    }
}

export async function fetchFred(indicators: string): Promise<CommandResult> {
    return invoke('fetch_fred', { indicators });
}

export async function getMacroData(): Promise<MacroData[]> {
    return invoke('get_macro_data');
}

export async function calculateIndicators(symbol: string): Promise<CommandResult> {
    return invoke('calculate_indicators', { symbol });
}

export async function getIndicators(symbol: string): Promise<IndicatorData[]> {
    if (!isTauri()) return httpGet(`/api/symbols/${symbol}/indicators`);
    return invoke('get_indicators', { symbol });
}

export async function getIndicatorHistory(symbol: string, indicatorName: string): Promise<{ date: string; value: number }[]> {
    return invoke('get_indicator_history', { symbol, indicatorName });
}

export async function getPriceHistory(symbol: string): Promise<PriceData[]> {
    if (!isTauri()) return httpGet(`/api/symbols/${symbol}/prices`);
    return invoke('get_price_history', { symbol });
}

export async function searchSymbol(query: string): Promise<string[]> {
    return invoke('search_symbol', { query });
}

export async function exportCsv(symbol: string): Promise<CommandResult> {
    return invoke('export_csv', { symbol });
}

// Alerts
export async function addAlert(symbol: string, targetPrice: number, condition: string): Promise<CommandResult> {
    return invoke('add_alert', { symbol, targetPrice, condition });
}

export async function getAlerts(onlyActive: boolean): Promise<Alert[]> {
    if (!isTauri()) return httpGet('/api/alerts');
    return invoke('get_alerts', { onlyActive });
}

export async function deleteAlert(alertId: number): Promise<CommandResult> {
    return invoke('delete_alert', { alertId });
}

export async function checkAlerts(): Promise<Alert[]> {
    const triggeredAlerts = await invoke<Alert[]>('check_alerts');
    if (triggeredAlerts.length > 0) {
        triggeredAlerts.forEach(alert => {
            addLog(`[ALERT] ${alert.symbol} ${alert.condition} $${alert.target_price} TRIGGERED!`, 'output');
            addOutput('Price Alerts', `${alert.symbol} hit ${alert.condition} $${alert.target_price}`);
        });
    }
    return triggeredAlerts;
}

// Portfolio
export async function addPosition(
    symbol: string,
    quantity: number,
    price: number,
    positionType: string,
    date: string,
    notes: string | null
): Promise<CommandResult> {
    return invoke('add_position', { symbol, quantity, price, positionType, date, notes });
}

export async function getPortfolio(): Promise<Portfolio> {
    if (!isTauri()) {
        const positions = await httpGet<Position[]>('/api/portfolio');
        const total_value = positions.reduce((sum, p) => sum + p.current_value, 0);
        const total_profit_loss = positions.reduce((sum, p) => sum + p.profit_loss, 0);
        const cost_basis = positions.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const total_profit_loss_percent = cost_basis > 0 ? (total_profit_loss / cost_basis) * 100 : 0;
        return { positions, total_value, total_profit_loss, total_profit_loss_percent };
    }
    return invoke('get_portfolio');
}

export async function deletePosition(positionId: number): Promise<CommandResult> {
    return invoke('delete_position', { positionId });
}

// Google Trends
export async function fetchTrends(keyword: string): Promise<CommandResult> {
    return invoke('fetch_trends', { keyword });
}

export async function getTrends(keyword: string): Promise<{ date: string; value: number }[]> {
    return invoke('get_trends', { keyword });
}

// Watchlists / Symbol Groups
export interface WatchlistSummary {
    id: number;
    name: string;
    description: string | null;
    symbol_count: number;
}

export interface WatchlistDetail {
    id: number;
    name: string;
    description: string | null;
    symbol_count: number;
    symbols: string[];
}

export async function createWatchlist(name: string, symbols: string[], description: string | null): Promise<CommandResult> {
    return invoke('create_watchlist', { name, symbols, description });
}

export async function getAllWatchlists(): Promise<WatchlistSummary[]> {
    if (!isTauri()) {
        const watchlists = await httpGet<{ id: number; name: string; description: string | null; symbols: string[] }[]>('/api/watchlists');
        return watchlists.map(w => ({ id: w.id, name: w.name, description: w.description, symbol_count: w.symbols.length }));
    }
    return invoke('get_all_watchlists');
}

export async function getWatchlistDetail(name: string): Promise<WatchlistDetail | null> {
    return invoke('get_watchlist_detail', { name });
}

export async function deleteWatchlist(name: string): Promise<CommandResult> {
    return invoke('delete_watchlist', { name });
}

export async function addSymbolToWatchlist(watchlistName: string, symbol: string): Promise<CommandResult> {
    return invoke('add_symbol_to_watchlist', { watchlistName, symbol });
}

export async function removeSymbolFromWatchlist(watchlistName: string, symbol: string): Promise<CommandResult> {
    return invoke('remove_symbol_from_watchlist', { watchlistName, symbol });
}

export async function updateWatchlistDescription(name: string, description: string | null): Promise<CommandResult> {
    return invoke('update_watchlist_description', { name, description });
}

export async function renameWatchlist(oldName: string, newName: string): Promise<CommandResult> {
    return invoke('rename_watchlist', { oldName, newName });
}

// Vector Database / AI Search
export interface VectorSearchResult {
    id: string;
    content: string;
    score: number;
    result_type: string;
    symbol: string | null;
    date: string | null;
}

export interface VectorStats {
    events_count: number;
    patterns_count: number;
}

export async function vectorSearch(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    return invoke('vector_search', { query, limit });
}

export async function addMarketEvent(
    symbol: string,
    eventType: string,
    title: string,
    content: string,
    date: string,
    sentiment: number | null
): Promise<CommandResult> {
    return invoke('add_market_event', { symbol, eventType, title, content, date, sentiment });
}

export async function addPricePattern(
    symbol: string,
    patternType: string,
    startDate: string,
    endDate: string,
    priceChangePercent: number,
    volumeChangePercent: number,
    description: string
): Promise<CommandResult> {
    return invoke('add_price_pattern', {
        symbol,
        patternType,
        startDate,
        endDate,
        priceChangePercent,
        volumeChangePercent,
        description
    });
}

export async function getVectorStats(): Promise<VectorStats> {
    return invoke('get_vector_stats');
}

// Claude AI Chat
export interface ClaudeChatResponse {
    response: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    conversation_id: string;
}

export async function claudeChat(query: string, apiKey: string): Promise<ClaudeChatResponse> {
    return invoke('claude_chat', { query, apiKey });
}

export async function claudeQuery(query: string, apiKey: string): Promise<ClaudeChatResponse> {
    return invoke('claude_query', { query, apiKey });
}

// Finnhub News
export interface SimpleNewsItem {
    headline: string;
    summary: string;
    source: string;
    url: string;
    date: string;
    symbol: string;
}

export interface FetchNewsResponse {
    news: SimpleNewsItem[];
    count: number;
}

export async function fetchNews(symbol: string, apiKey: string, limit: number = 5): Promise<FetchNewsResponse> {
    return invoke('fetch_news', { symbol, apiKey, limit });
}

// Prediction tracking
export interface SavePredictionParams {
    finnhub_id: number;
    symbol: string;
    headline: string;
    prediction_summary: string;
    predicted_direction?: 'bullish' | 'bearish' | 'neutral';
    predicted_price?: number;
    predicted_change_percent?: number;
    source: string;
    timeframe_days?: number;
}

export async function savePrediction(params: SavePredictionParams): Promise<CommandResult> {
    return invoke('save_prediction', { ...params });
}

export interface VerificationResult {
    prediction_id: number;
    symbol: string;
    source: string;
    predicted_direction: string | null;
    predicted_change: number | null;
    actual_change: number;
    accurate: boolean;
    notes: string;
}

export async function verifyPredictions(): Promise<VerificationResult[]> {
    return invoke('verify_predictions');
}

export interface SourceScore {
    source: string;
    total: number;
    accurate: number;
    rate: number;
    avg_error: number | null;
}

export async function getSourceScores(): Promise<[string, number, number, number, number | null][]> {
    return invoke('get_source_scores');
}

// Price Reaction (candle data around an event)
export interface PriceReactionResponse {
    symbol: string;
    event_date: string;
    start_date: string;
    end_date: string;
    pre_price: number;
    post_price: number;
    price_change_percent: number;
    volume_change_percent: number;
    candle_count: number;
}

export async function fetchPriceReaction(
    symbol: string,
    eventDate: string,
    apiKey: string,
    daysWindow: number = 3
): Promise<PriceReactionResponse> {
    return invoke('fetch_price_reaction', { symbol, eventDate, apiKey, daysWindow });
}

// Raw candle data
export interface CandleDataResponse {
    symbol: string;
    close: number[];
    high: number[];
    low: number[];
    open: number[];
    volume: number[];
    timestamp: number[];
    dates: string[];  // YYYY-MM-DD format
}

export async function fetchCandles(
    symbol: string,
    fromDate: string,
    toDate: string,
    apiKey: string,
    resolution: string = 'D'
): Promise<CandleDataResponse> {
    return invoke('fetch_candles', { symbol, fromDate, toDate, apiKey, resolution });
}

// Enhanced event saving with pattern linking
export interface EventWithPatternResponse {
    success: boolean;
    message: string;
    event_id: string;
    pattern_id: string | null;
    price_change_percent: number | null;
    pattern_error: string | null;  // Actual error reason for debugging
}

export async function addMarketEventWithPattern(
    symbol: string,
    eventType: string,
    title: string,
    content: string,
    date: string,
    sentiment: number | null,
    apiKey: string | null,
    linkPattern: boolean,
    daysWindow: number = 3
): Promise<EventWithPatternResponse> {
    return invoke('add_market_event_with_pattern', {
        symbol,
        eventType,
        title,
        content,
        date,
        sentiment,
        apiKey,
        linkPattern,
        daysWindow
    });
}

// Open article in lightweight Tauri webview window
export async function openArticleWindow(url: string, title: string): Promise<void> {
    return invoke('open_article_window', { url, title });
}

// ============================================================================
// PAPER TRADING
// ============================================================================

export interface PaperWalletBalance {
    cash: number;
    positions_value: number;
    total_equity: number;
    starting_capital: number;
    total_pnl: number;
    total_pnl_percent: number;
}

export interface PaperPosition {
    id: number;
    symbol: string;
    quantity: number;
    entry_price: number;
    entry_date: string;
    current_price: number;
    current_value: number;
    cost_basis: number;
    unrealized_pnl: number;
    unrealized_pnl_percent: number;
}

export interface PaperTrade {
    id: number;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    pnl: number | null;
    timestamp: string;
    notes: string | null;
}

// Get paper trading balance and portfolio summary
export async function getPaperBalance(): Promise<PaperWalletBalance> {
    if (!isTauri()) {
        const data = await httpGet<{ cash: number; positions_value: number; total_value: number }>('/api/paper/balance');
        const starting_capital = 1000000; // Default starting capital (matches DB default)
        return {
            cash: data.cash,
            positions_value: data.positions_value,
            total_equity: data.total_value,
            starting_capital,
            total_pnl: data.total_value - starting_capital,
            total_pnl_percent: ((data.total_value - starting_capital) / starting_capital) * 100,
        };
    }
    return invoke('get_paper_balance');
}

// Get all paper trading positions with current values
export async function getPaperPositions(): Promise<PaperPosition[]> {
    if (!isTauri()) {
        const positions = await httpGet<{ symbol: string; shares: number; avg_cost: number; current_price: number; market_value: number; unrealized_pnl: number; unrealized_pnl_percent: number }[]>('/api/paper/positions');
        return positions.map((p, i) => ({
            id: i,
            symbol: p.symbol,
            quantity: p.shares,
            entry_price: p.avg_cost,
            entry_date: '',
            current_price: p.current_price,
            current_value: p.market_value,
            cost_basis: p.avg_cost * p.shares,
            unrealized_pnl: p.unrealized_pnl,
            unrealized_pnl_percent: p.unrealized_pnl_percent,
        }));
    }
    return invoke('get_paper_positions');
}

// Execute a paper trade (BUY or SELL)
export async function executePaperTrade(
    symbol: string,
    action: 'BUY' | 'SELL',
    quantity: number,
    price?: number,
    notes?: string
): Promise<PaperTrade> {
    try {
        addLog(`[KALIC] ${action} ${quantity} ${symbol}${price ? ` @ $${price.toFixed(2)}` : ''}...`, 'command');
        const trade = await invoke<PaperTrade>('execute_paper_trade', { symbol, action, quantity, price, notes });
        const value = trade.quantity * trade.price;
        addLog(`[KALIC] EXECUTED: ${action} ${trade.quantity} ${symbol} @ $${trade.price.toFixed(2)} = $${value.toFixed(2)}`);
        addOutput('KALIC Trader', `${action} ${symbol} x${trade.quantity} @ $${trade.price.toFixed(2)}`);
        return trade;
    } catch (err) {
        addLog(`[KALIC] FAILED: ${action} ${symbol} - ${err}`, 'error');
        addProblem('error', `Trade failed: ${action} ${symbol} - ${err}`, 'KALIC Trader');
        throw err;
    }
}

// Get paper trade history
export async function getPaperTrades(symbol?: string, limit?: number): Promise<PaperTrade[]> {
    return invoke('get_paper_trades', { symbol, limit });
}

// Reset paper trading account
export async function resetPaperAccount(startingCash?: number): Promise<CommandResult> {
    addLog(`[KALIC] RESET account to $${(startingCash || 1000000).toLocaleString()}`, 'command');
    const result = await invoke<CommandResult>('reset_paper_account', { startingCash });
    addOutput('KALIC Trader', `Account reset to $${(startingCash || 1000000).toLocaleString()}`);
    return result;
}

// ============================================================================
// DC TRADER (Separate from KALIC AI paper trading)
// ============================================================================

export interface DcWalletBalance {
    cash: number;
    positions_value: number;
    total_equity: number;
    starting_capital: number;
    total_pnl: number;
    total_pnl_percent: number;
}

export interface DcPosition {
    id: number;
    symbol: string;
    quantity: number;
    entry_price: number;
    entry_date: string;
    current_price: number;
    current_value: number;
    cost_basis: number;
    unrealized_pnl: number;
    unrealized_pnl_percent: number;
}

export interface DcTrade {
    id: number;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    pnl: number | null;
    timestamp: string;
    notes: string | null;
}

export interface ImportResult {
    success_count: number;
    error_count: number;
    errors: string[];
}

export interface PortfolioSnapshot {
    id: number;
    team: string;
    date: string;
    total_value: number;
    cash: number;
    positions_value: number;
}

export interface TeamConfig {
    id: number;
    name: string;
    description: string | null;
    kalic_starting_capital: number;
    dc_starting_capital: number;
    created_at: string;
}

export interface CompetitionStats {
    kalic_total: number;
    kalic_cash: number;
    kalic_positions: number;
    kalic_pnl_pct: number;
    kalic_trades: number;
    dc_total: number;
    dc_cash: number;
    dc_positions: number;
    dc_pnl_pct: number;
    dc_trades: number;
    leader: string;
    lead_amount: number;
}

// Get DC wallet balance and portfolio summary
export async function getDcBalance(): Promise<DcWalletBalance> {
    if (!isTauri()) {
        const data = await httpGet<{ cash: number; positions_value: number; total_value: number }>('/api/dc/balance');
        const starting_capital = 1000000; // Default starting capital (matches DB default)
        return {
            cash: data.cash,
            positions_value: data.positions_value,
            total_equity: data.total_value,
            starting_capital,
            total_pnl: data.total_value - starting_capital,
            total_pnl_percent: ((data.total_value - starting_capital) / starting_capital) * 100,
        };
    }
    return invoke('get_dc_balance');
}

// Get all DC positions with current values
export async function getDcPositions(): Promise<DcPosition[]> {
    if (!isTauri()) {
        const positions = await httpGet<{ symbol: string; shares: number; avg_cost: number; current_price: number; market_value: number; unrealized_pnl: number; unrealized_pnl_percent: number }[]>('/api/dc/positions');
        return positions.map((p, i) => ({
            id: i,
            symbol: p.symbol,
            quantity: p.shares,
            entry_price: p.avg_cost,
            entry_date: '',
            current_price: p.current_price,
            current_value: p.market_value,
            cost_basis: p.avg_cost * p.shares,
            unrealized_pnl: p.unrealized_pnl,
            unrealized_pnl_percent: p.unrealized_pnl_percent,
        }));
    }
    return invoke('get_dc_positions');
}

// Execute a DC trade (BUY or SELL)
export async function executeDcTrade(
    symbol: string,
    action: 'BUY' | 'SELL',
    quantity: number,
    price?: number,
    notes?: string
): Promise<DcTrade> {
    try {
        addLog(`[DC] ${action} ${quantity} ${symbol}${price ? ` @ $${price.toFixed(2)}` : ''}...`, 'command');
        const trade = await invoke<DcTrade>('execute_dc_trade', { symbol, action, quantity, price, notes });
        const value = trade.quantity * trade.price;
        addLog(`[DC] EXECUTED: ${action} ${trade.quantity} ${symbol} @ $${trade.price.toFixed(2)} = $${value.toFixed(2)}`);
        addOutput('DC Trader', `${action} ${symbol} x${trade.quantity} @ $${trade.price.toFixed(2)}`);
        return trade;
    } catch (err) {
        addLog(`[DC] FAILED: ${action} ${symbol} - ${err}`, 'error');
        addProblem('error', `Trade failed: ${action} ${symbol} - ${err}`, 'DC Trader');
        throw err;
    }
}

// Get DC trade history
export async function getDcTrades(limit?: number): Promise<DcTrade[]> {
    return invoke('get_dc_trades', { limit });
}

// Reset DC trading account
export async function resetDcAccount(startingCash?: number): Promise<CommandResult> {
    addLog(`[DC] RESET account to $${(startingCash || 1000000).toLocaleString()}`, 'command');
    const result = await invoke<CommandResult>('reset_dc_account', { starting_cash: startingCash });
    addOutput('DC Trader', `Account reset to $${(startingCash || 1000000).toLocaleString()}`);
    return result;
}

// Import DC trades from CSV
export async function importDcTradesCsv(csvContent: string): Promise<ImportResult> {
    return invoke('import_dc_trades_csv', { csvContent });
}

// Import DC trades from JSON
export async function importDcTradesJson(jsonContent: string): Promise<ImportResult> {
    return invoke('import_dc_trades_json', { jsonContent });
}

// Lookup current price for a symbol
export async function lookupCurrentPrice(symbol: string): Promise<number> {
    return invoke('lookup_current_price', { symbol });
}

// Record portfolio snapshot for a team
export async function recordPortfolioSnapshot(team: 'KALIC' | 'DC'): Promise<CommandResult> {
    return invoke('record_portfolio_snapshot', { team });
}

// Get portfolio snapshots for charting
export async function getPortfolioSnapshots(team?: 'KALIC' | 'DC', days?: number): Promise<PortfolioSnapshot[]> {
    return invoke('get_portfolio_snapshots', { team, days });
}

// Save team configuration
export async function saveTeamConfig(name: string, description?: string): Promise<number> {
    return invoke('save_team_config', { name, description });
}

// Load team configuration
export async function loadTeamConfig(name: string): Promise<TeamConfig> {
    return invoke('load_team_config', { name });
}

// List all team configurations
export async function listTeamConfigs(): Promise<TeamConfig[]> {
    return invoke('list_team_configs');
}

// Get competition stats
export async function getCompetitionStats(): Promise<CompetitionStats> {
    if (!isTauri()) {
        const data = await httpGet<{
            kalic_value: number; kalic_pnl: number; kalic_pnl_percent: number; kalic_trades: number;
            dc_value: number; dc_pnl: number; dc_pnl_percent: number; dc_trades: number;
            leader: string; lead_amount: number;
        }>('/api/competition/stats');
        return {
            kalic_total: data.kalic_value,
            kalic_cash: 0, // Not in HTTP response
            kalic_positions: data.kalic_value,
            kalic_pnl_pct: data.kalic_pnl_percent,
            kalic_trades: data.kalic_trades,
            dc_total: data.dc_value,
            dc_cash: 0,
            dc_positions: data.dc_value,
            dc_pnl_pct: data.dc_pnl_percent,
            dc_trades: data.dc_trades,
            leader: data.leader,
            lead_amount: data.lead_amount,
        };
    }
    return invoke('get_competition_stats');
}

// ============================================================================
// AI TRADER
// ============================================================================

export interface AiTradingSession {
    id: number;
    start_time: string;
    end_time: string | null;
    starting_portfolio_value: number;
    ending_portfolio_value: number | null;
    decisions_count: number;
    trades_count: number;
    session_notes: string | null;
    status: string;
}

export interface AiTradeDecision {
    id: number;
    session_id: number | null;
    timestamp: string;
    action: string;
    symbol: string;
    quantity: number | null;
    price_at_decision: number | null;
    confidence: number;
    reasoning: string;
    model_used: string;
    predicted_direction: string | null;
    predicted_price_target: number | null;
    predicted_timeframe_days: number | null;
    actual_outcome: string | null;
    actual_price_at_timeframe: number | null;
    prediction_accurate: boolean | null;
    paper_trade_id: number | null;
}

export interface AiPerformanceSnapshot {
    id: number;
    timestamp: string;
    portfolio_value: number;
    cash: number;
    positions_value: number;
    benchmark_value: number;
    benchmark_symbol: string;
    total_pnl: number;
    total_pnl_percent: number;
    benchmark_pnl_percent: number;
    prediction_accuracy: number | null;
    trades_to_date: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number | null;
}

export interface AiTraderStatus {
    is_running: boolean;
    current_session: AiTradingSession | null;
    portfolio_value: number;
    cash: number;
    positions_value: number;
    is_bankrupt: boolean;
    sessions_completed: number;
    total_decisions: number;
    total_trades: number;
}

export interface AiBenchmarkComparison {
    portfolio_return_percent: number;
    benchmark_return_percent: number;
    alpha: number;
    tracking_data: [string, number, number][]; // [timestamp, portfolio, benchmark]
}

export interface AiCompoundingForecast {
    current_daily_return: number;
    current_win_rate: number;
    projected_30_days: number;
    projected_90_days: number;
    projected_365_days: number;
    time_to_double: number | null;
    time_to_bankruptcy: number | null;
}

export interface AiPredictionAccuracy {
    total_predictions: number;
    accurate_predictions: number;
    accuracy_percent: number;
}

export interface AiTraderConfig {
    starting_capital: number;
    max_position_size_percent: number;
    stop_loss_percent: number;
    take_profit_percent: number;
    session_duration_minutes: number;
    benchmark_symbol: string;
    model_priority: string[];
}

// Get AI trader status
export async function aiTraderGetStatus(): Promise<AiTraderStatus> {
    return invoke('ai_trader_get_status');
}

// Get AI trader configuration
export async function aiTraderGetConfig(): Promise<AiTraderConfig> {
    return invoke('ai_trader_get_config');
}

// Start a new AI trading session
export async function aiTraderStartSession(): Promise<AiTradingSession> {
    return invoke('ai_trader_start_session');
}

// End the current AI trading session
export async function aiTraderEndSession(notes?: string): Promise<AiTradingSession | null> {
    return invoke('ai_trader_end_session', { notes });
}

// Run one AI trading cycle
export async function aiTraderRunCycle(): Promise<AiTradeDecision[]> {
    return invoke('ai_trader_run_cycle');
}

// Get AI trading decisions
export async function aiTraderGetDecisions(
    sessionId?: number,
    symbol?: string,
    limit?: number
): Promise<AiTradeDecision[]> {
    return invoke('ai_trader_get_decisions', { sessionId, symbol, limit });
}

// Get AI performance history (snapshots)
export async function aiTraderGetPerformanceHistory(days?: number): Promise<AiPerformanceSnapshot[]> {
    return invoke('ai_trader_get_performance_history', { days });
}

// Get benchmark comparison
export async function aiTraderGetBenchmarkComparison(): Promise<AiBenchmarkComparison> {
    return invoke('ai_trader_get_benchmark_comparison');
}

// Get compounding forecast
export async function aiTraderGetCompoundingForecast(): Promise<AiCompoundingForecast> {
    return invoke('ai_trader_get_compounding_forecast');
}

// Get prediction accuracy
export async function aiTraderGetPredictionAccuracy(): Promise<AiPredictionAccuracy> {
    return invoke('ai_trader_get_prediction_accuracy');
}

// Evaluate pending predictions
export async function aiTraderEvaluatePredictions(): Promise<number> {
    return invoke('ai_trader_evaluate_predictions');
}

// Reset AI trading
export async function aiTraderReset(startingCapital?: number): Promise<CommandResult> {
    return invoke('ai_trader_reset', { startingCapital });
}

// ============================================================================
// REPORTS
// ============================================================================

export interface ReportItem {
    name: string;
    path: string;
    date: string;
    report_type: string;
    size_kb: number;
}

// Get list of all reports
export async function getReportList(): Promise<ReportItem[]> {
    if (!isTauri()) return httpGet('/api/reports');
    return invoke('get_report_list');
}

// Get report content
export async function getReportContent(path: string): Promise<string> {
    if (!isTauri()) {
        const response = await fetch(`${API_BASE}/api/reports/content?path=${encodeURIComponent(path)}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return response.text();
    }
    return invoke('get_report_content', { path });
}

// Generate PDF from markdown report
export async function generatePdfReport(sourcePath: string): Promise<CommandResult> {
    return invoke('generate_pdf_report', { sourcePath });
}

// ============================================================================
// Trade Queue API
// ============================================================================

export interface QueuedTrade {
    id: number;
    portfolio: string;
    symbol: string;
    action: string;
    quantity: number;
    target_price: number | null;
    status: string;
    source: string;
    debate_date: string | null;
    conviction: number | null;
    reasoning: string | null;
    created_at: string;
    scheduled_for: string | null;
    executed_at: string | null;
    execution_price: number | null;
    execution_trade_id: number | null;
    error_message: string | null;
}

export interface SchedulerStatus {
    running: boolean;
    queued_count: number;
    current_et_time: string;
    market_open: boolean;
    next_market_open: string;
}

export interface QueueResponse {
    id: number;
    status: string;
    message: string;
}

export interface BatchQueueResponse {
    queued: QueueResponse[];
    total: number;
    success_count: number;
    fail_count: number;
}

export async function getTradeQueue(status?: string): Promise<QueuedTrade[]> {
    const params = status ? `?status=${status}` : '';
    const response = await fetch(`${API_BASE}/api/queue${params}`);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
}

export async function cancelQueuedTrade(id: number): Promise<QueueResponse> {
    const response = await fetch(`${API_BASE}/api/queue/${id}/cancel`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
    const response = await fetch(`${API_BASE}/api/scheduler/status`);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
}

export async function getPendingQueueCount(): Promise<{ count: number }> {
    const response = await fetch(`${API_BASE}/api/queue/pending-count`);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
}

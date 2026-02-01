import { Component, For, createResource, createEffect, onCleanup } from 'solid-js';
import { symbolStore, settingsStore } from '../stores';
import { formatCurrency, formatPercent } from '../utils';
import {
  getCompetitionStats,
  getPaperBalance,
  getPaperPositions,
  getPaperTrades,
  getSymbols,
  type CompetitionStats,
  type PaperWalletBalance,
  type SymbolPrice,
} from '../api';

interface StatCard {
  label: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
}

// Build stats from real data
const buildStats = (
  competition: CompetitionStats | undefined,
  balance: PaperWalletBalance | undefined
): StatCard[] => {
  if (!competition || !balance) {
    return [
      { label: 'Portfolio Value', value: 'Loading...', changeType: 'neutral' },
      { label: 'Cash Available', value: 'Loading...', changeType: 'neutral' },
      { label: 'Total P&L', value: 'Loading...', changeType: 'neutral' },
      { label: 'Leader', value: 'Loading...', changeType: 'neutral' },
    ];
  }

  const pnlType = balance.total_pnl >= 0 ? 'up' : 'down';
  const cashPercent = ((balance.cash / balance.total_equity) * 100).toFixed(1);

  return [
    {
      label: 'Portfolio Value',
      value: formatCurrency(balance.total_equity),
      change: `${balance.total_pnl_percent >= 0 ? '+' : ''}${balance.total_pnl_percent.toFixed(2)}% total`,
      changeType: pnlType
    },
    {
      label: 'Cash Available',
      value: formatCurrency(balance.cash),
      change: `${cashPercent}% of portfolio`,
      changeType: 'neutral'
    },
    {
      label: 'Total P&L',
      value: `${balance.total_pnl >= 0 ? '+' : ''}${formatCurrency(balance.total_pnl)}`,
      change: `KALIC: ${competition.kalic_trades} trades`,
      changeType: pnlType
    },
    {
      label: 'Leader',
      value: competition.leader,
      change: `+${formatCurrency(competition.lead_amount)} ahead`,
      changeType: competition.leader === 'KALIC' ? 'up' : 'down'
    },
  ];
};

// TopMover now comes from API via getSymbols()
interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  marketCap: string;
}

// Convert API SymbolPrice to TopMover format
const symbolToMover = (s: SymbolPrice): TopMover => ({
  symbol: s.symbol,
  name: s.symbol,
  price: s.price,
  change: s.change_percent,
  volume: '-',
  marketCap: '-',
});

export const Dashboard: Component = () => {
  // === REAL DATA FETCHING ===

  // Fetch competition stats
  const [competitionData, { refetch: refetchCompetition }] = createResource(getCompetitionStats);

  // Fetch paper balance
  const [balanceData, { refetch: refetchBalance }] = createResource(getPaperBalance);

  // Fetch positions
  const [positionsData, { refetch: refetchPositions }] = createResource(getPaperPositions);

  // Fetch recent trades (limit 10)
  const [tradesData, { refetch: refetchTrades }] = createResource(() => getPaperTrades(undefined, 10));

  // Fetch symbols for top movers
  const [symbolsData, { refetch: refetchSymbols }] = createResource(getSymbols);

  // Reactive stats from real data
  const stats = () => buildStats(competitionData(), balanceData());

  // Top movers from real symbols (sorted by change)
  const topMovers = () => {
    const symbols = symbolsData() || [];
    return symbols
      .map(symbolToMover)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10);
  };

  // Handle row click in top movers table
  const handleMoverClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  // Refresh data
  const handleRefresh = () => {
    refetchCompetition();
    refetchBalance();
    refetchPositions();
    refetchTrades();
    refetchSymbols();
  };

  // Auto-refresh portfolio data based on settings interval
  let refreshInterval: number | undefined;

  createEffect(() => {
    const intervalMs = settingsStore.state.autoRefreshInterval * 1000;
    if (refreshInterval) window.clearInterval(refreshInterval);
    if (intervalMs > 0) {
      refreshInterval = window.setInterval(() => {
        refetchCompetition();
        refetchBalance();
        refetchPositions();
        refetchTrades();
      }, intervalMs);
    }
  });

  onCleanup(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
    }
  });

  return (
    <div class="editor-content">
      {/* Stats Grid */}
      <div class="stats-grid" style={{ 'margin-bottom': 'var(--space-4)' }}>
        <For each={stats()}>
          {(stat) => (
            <div class="stat-card">
              <div class="stat-label">{stat.label}</div>
              <div class={`stat-value ${stat.changeType === 'up' ? 'text-up' : ''}`}>
                {stat.value}
              </div>
              <div class={`stat-change ${stat.changeType === 'up' ? 'text-up' : stat.changeType === 'down' ? 'text-down' : 'text-muted'}`}>
                {stat.changeType === 'up' ? '▲ ' : stat.changeType === 'down' ? '▼ ' : ''}{stat.change}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Holdings & Recent Trades Row */}
      <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: 'var(--space-4)', 'margin-bottom': 'var(--space-4)' }}>
        {/* Current Holdings */}
        <div class="card">
          <div class="card-header">
            <span class="card-title">Current Holdings ({(positionsData() || []).length})</span>
            <button class="btn btn-icon btn-ghost" title="Refresh" onClick={handleRefresh}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
          </div>
          <div style={{ 'max-height': '250px', 'overflow-y': 'auto' }}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                <For each={positionsData() || []} fallback={
                  <tr><td colspan="4" class="text-center text-muted">No positions</td></tr>
                }>
                  {(pos) => (
                    <tr class="clickable-row" onClick={() => handleMoverClick(pos.symbol)}>
                      <td class="mono" style={{ 'font-weight': '600' }}>{pos.symbol}</td>
                      <td class="mono">{pos.quantity}</td>
                      <td class="mono">{formatCurrency(pos.current_value)}</td>
                      <td class={`mono ${pos.unrealized_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealized_pnl)}
                        <span class="text-muted"> ({pos.unrealized_pnl_percent.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Trades */}
        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Trades</span>
          </div>
          <div style={{ 'max-height': '250px', 'overflow-y': 'auto' }}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th>Qty</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <For each={tradesData() || []} fallback={
                  <tr><td colspan="5" class="text-center text-muted">No trades yet</td></tr>
                }>
                  {(trade) => (
                    <tr>
                      <td class="text-muted">{trade.timestamp.split('T')[0]}</td>
                      <td class="mono" style={{ 'font-weight': '600' }}>{trade.symbol}</td>
                      <td>
                        <span class={`action-badge ${trade.action.toLowerCase()}`}>
                          {trade.action}
                        </span>
                      </td>
                      <td class="mono">{trade.quantity}</td>
                      <td class="mono">{formatCurrency(trade.price)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div class="card">
        <div class="card-header">
          <span class="card-title">Top Movers Today</span>
        </div>
        <div style={{ 'max-height': '250px', 'overflow-y': 'auto' }}>
          <table class="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <For each={topMovers()}>
                {(stock) => (
                  <tr
                    class={`clickable-row ${symbolStore.state.selectedSymbol === stock.symbol ? 'selected' : ''}`}
                    onClick={() => handleMoverClick(stock.symbol)}
                  >
                    <td class="mono" style={{ 'font-weight': '600' }}>{stock.symbol}</td>
                    <td class="mono">{formatCurrency(stock.price)}</td>
                    <td class={`mono ${stock.change >= 0 ? 'text-up' : 'text-down'}`}>
                      {formatPercent(stock.change)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
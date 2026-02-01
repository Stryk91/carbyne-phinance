import { Component, For, Show, createSignal, createResource, createEffect, onCleanup } from 'solid-js';
import { formatCurrency } from '../utils';
import { settingsStore } from '../stores';
import {
  getCompetitionStats,
  getPaperBalance,
  getPaperPositions,
  getPaperTrades,
  getDcBalance,
  getDcPositions,
  getDcTrades,
  addAlert,
  executePaperTrade,
  executeDcTrade,
} from '../api';

type TabType = 'overview' | 'positions' | 'trades' | 'history';

export const Portfolio: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabType>('overview');
  const [tradeLimit, setTradeLimit] = createSignal(50);

  // Fetch competition stats
  const [competitionData, { refetch: refetchCompetition }] = createResource(getCompetitionStats);

  // Fetch balances for both teams
  const [kalicBalance, { refetch: refetchKalicBalance }] = createResource(getPaperBalance);
  const [dcBalance, { refetch: refetchDcBalance }] = createResource(getDcBalance);

  // Fetch positions based on active team
  const [kalicPositions, { refetch: refetchKalicPositions }] = createResource(getPaperPositions);
  const [dcPositions, { refetch: refetchDcPositions }] = createResource(getDcPositions);

  // Fetch trades based on active team
  const [kalicTrades, { refetch: refetchKalicTrades }] = createResource(() => tradeLimit(), (limit) => getPaperTrades(undefined, limit));
  const [dcTrades, { refetch: refetchDcTrades }] = createResource(() => tradeLimit(), (limit) => getDcTrades(limit));

  const [lastRefresh, setLastRefresh] = createSignal('');

  // Refresh all portfolio data
  const refreshAll = () => {
    refetchCompetition();
    refetchKalicBalance();
    refetchDcBalance();
    refetchKalicPositions();
    refetchDcPositions();
    refetchKalicTrades();
    refetchDcTrades();
    setLastRefresh(new Date().toLocaleTimeString());
  };

  // Auto-refresh based on settings interval
  let refreshInterval: number | undefined;

  createEffect(() => {
    const intervalMs = settingsStore.state.autoRefreshInterval * 1000;
    if (refreshInterval) window.clearInterval(refreshInterval);
    if (intervalMs > 0) {
      refreshInterval = window.setInterval(refreshAll, intervalMs);
    }
  });

  onCleanup(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
    }
  });

  // Current team data
  const currentBalance = () => settingsStore.state.activeTeam === 'KALIC' ? kalicBalance() : dcBalance();
  const currentPositions = () => settingsStore.state.activeTeam === 'KALIC' ? kalicPositions() : dcPositions();
  const currentTrades = () => settingsStore.state.activeTeam === 'KALIC' ? kalicTrades() : dcTrades();

  const handleTeamSwitch = (team: 'KALIC' | 'DC') => {
    settingsStore.setActiveTeam(team);
  };

  const handleRefresh = () => {
    refreshAll();
  };

  // Set stop-loss alert (default 5% below current price)
  const handleSetStopLoss = async (symbol: string, currentPrice: number) => {
    const stopPrice = currentPrice * 0.95; // 5% stop loss
    try {
      await addAlert(symbol, stopPrice, 'below');
      alert(`Stop-loss alert set for ${symbol} at ${formatCurrency(stopPrice)}`);
    } catch (e) {
      alert(`Error setting stop-loss: ${e}`);
    }
  };

  // Set take-profit alert (default 15% above current price)
  const handleSetTakeProfit = async (symbol: string, currentPrice: number) => {
    const targetPrice = currentPrice * 1.15; // 15% take profit
    try {
      await addAlert(symbol, targetPrice, 'above');
      alert(`Take-profit alert set for ${symbol} at ${formatCurrency(targetPrice)}`);
    } catch (e) {
      alert(`Error setting take-profit: ${e}`);
    }
  };

  // Manual trade form
  const [tradeSymbol, setTradeSymbol] = createSignal('');
  const [tradeAction, setTradeAction] = createSignal<'BUY' | 'SELL'>('BUY');
  const [tradeQty, setTradeQty] = createSignal('');
  const [tradePrice, setTradePrice] = createSignal('');
  const [tradeNotes, setTradeNotes] = createSignal('');
  const [tradeSubmitting, setTradeSubmitting] = createSignal(false);
  const [tradeMsg, setTradeMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTradeForm, setShowTradeForm] = createSignal(false);

  const handleSubmitTrade = async () => {
    const symbol = tradeSymbol().trim().toUpperCase();
    const qty = parseFloat(tradeQty());
    if (!symbol || isNaN(qty) || qty <= 0) {
      setTradeMsg({ type: 'error', text: 'Valid symbol and quantity required' });
      setTimeout(() => setTradeMsg(null), 3000);
      return;
    }
    const price = tradePrice() ? parseFloat(tradePrice()) : undefined;
    const notes = tradeNotes().trim() || undefined;
    setTradeSubmitting(true);
    try {
      if (settingsStore.state.activeTeam === 'KALIC') {
        await executePaperTrade(symbol, tradeAction(), qty, price, notes);
      } else {
        await executeDcTrade(symbol, tradeAction(), qty, price, notes);
      }
      setTradeMsg({ type: 'success', text: `${tradeAction()} ${qty} ${symbol} executed` });
      setTradeSymbol(''); setTradeQty(''); setTradePrice(''); setTradeNotes('');
      refreshAll();
    } catch (e) {
      setTradeMsg({ type: 'error', text: `Trade failed: ${e}` });
    } finally {
      setTradeSubmitting(false);
      setTimeout(() => setTradeMsg(null), 4000);
    }
  };

  return (
    <div class="editor-content">
      {/* Competition Header */}
      <div class="competition-header">
        <div class="competition-title">
          <h2>KALIC vs DC Competition</h2>
          <button class="btn btn-icon btn-ghost" onClick={handleRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>

        <Show when={competitionData()}>
          {(stats) => (
            <div class="competition-scoreboard">
              <div class={`team-card ${stats().leader === 'KALIC' ? 'leading' : ''}`}>
                <div class="team-name">KALIC</div>
                <div class="team-value">{formatCurrency(stats().kalic_total)}</div>
                <div class={`team-pnl ${stats().kalic_pnl_pct >= 0 ? 'up' : 'down'}`}>
                  {stats().kalic_pnl_pct >= 0 ? '+' : ''}{stats().kalic_pnl_pct.toFixed(2)}%
                </div>
                <div class="team-stats">
                  <span>{stats().kalic_trades} trades</span>
                  <span>{formatCurrency(stats().kalic_cash)} cash</span>
                </div>
              </div>

              <div class="competition-vs">
                <div class="vs-text">VS</div>
                <div class="lead-indicator">
                  <span class={stats().leader === 'KALIC' ? 'kalic' : 'dc'}>
                    {stats().leader} leads by {formatCurrency(stats().lead_amount)}
                  </span>
                </div>
              </div>

              <div class={`team-card ${stats().leader === 'DC' ? 'leading' : ''}`}>
                <div class="team-name">DC</div>
                <div class="team-value">{formatCurrency(stats().dc_total)}</div>
                <div class={`team-pnl ${stats().dc_pnl_pct >= 0 ? 'up' : 'down'}`}>
                  {stats().dc_pnl_pct >= 0 ? '+' : ''}{stats().dc_pnl_pct.toFixed(2)}%
                </div>
                <div class="team-stats">
                  <span>{stats().dc_trades} trades</span>
                  <span>{formatCurrency(stats().dc_cash)} cash</span>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Team Selector Tabs */}
      <div class="portfolio-tabs">
        <div class="team-selector">
          <button
            class={`team-btn ${settingsStore.state.activeTeam === 'KALIC' ? 'active' : ''}`}
            onClick={() => handleTeamSwitch('KALIC')}
          >
            KALIC
          </button>
          <button
            class={`team-btn ${settingsStore.state.activeTeam === 'DC' ? 'active' : ''}`}
            onClick={() => handleTeamSwitch('DC')}
          >
            DC
          </button>
        </div>

        <div class="view-tabs" style={{ display: 'flex', 'align-items': 'center', gap: 'var(--space-2)' }}>
          <button
            class={`tab-btn ${activeTab() === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            class={`tab-btn ${activeTab() === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            Positions
          </button>
          <button
            class={`tab-btn ${activeTab() === 'trades' ? 'active' : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            Trades
          </button>
          <Show when={lastRefresh()}>
            <span class="timestamp-badge">{lastRefresh()}</span>
          </Show>
        </div>
      </div>

      {/* Quick Trade */}
      <div style={{ padding: '0 var(--space-3)' }}>
        <button
          class="btn btn-sm"
          style={{ 'margin-bottom': 'var(--space-2)', background: showTradeForm() ? 'var(--bg-selected)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', 'font-size': '11px', padding: '3px 10px' }}
          onClick={() => setShowTradeForm(!showTradeForm())}
        >
          {showTradeForm() ? 'Hide Trade' : 'Quick Trade'}
        </button>
        <Show when={showTradeForm()}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', 'align-items': 'center', 'flex-wrap': 'wrap', 'margin-bottom': 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', 'border-radius': '4px' }}>
            <select
              style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 'border-radius': '3px', padding: '4px 6px', 'font-size': '12px', width: '65px' }}
              onChange={(e) => setTradeAction(e.currentTarget.value as 'BUY' | 'SELL')}
              value={tradeAction()}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input
              type="text"
              placeholder="Symbol"
              style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 'border-radius': '3px', padding: '4px 6px', 'font-size': '12px', width: '70px', 'text-transform': 'uppercase' }}
              value={tradeSymbol()}
              onInput={(e) => setTradeSymbol(e.currentTarget.value)}
            />
            <input
              type="number"
              placeholder="Qty"
              style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 'border-radius': '3px', padding: '4px 6px', 'font-size': '12px', width: '60px' }}
              value={tradeQty()}
              onInput={(e) => setTradeQty(e.currentTarget.value)}
            />
            <input
              type="number"
              placeholder="Price (opt)"
              style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 'border-radius': '3px', padding: '4px 6px', 'font-size': '12px', width: '85px' }}
              value={tradePrice()}
              onInput={(e) => setTradePrice(e.currentTarget.value)}
            />
            <input
              type="text"
              placeholder="Notes (opt)"
              style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 'border-radius': '3px', padding: '4px 6px', 'font-size': '12px', width: '100px' }}
              value={tradeNotes()}
              onInput={(e) => setTradeNotes(e.currentTarget.value)}
            />
            <button
              class="btn btn-sm"
              style={{
                background: tradeAction() === 'BUY' ? 'var(--color-success)' : 'var(--color-error)',
                color: 'white',
                border: 'none',
                padding: '4px 12px',
                'font-size': '11px',
                'font-weight': '600',
              }}
              onClick={handleSubmitTrade}
              disabled={tradeSubmitting()}
            >
              {tradeSubmitting() ? '...' : `${tradeAction()} (${settingsStore.state.activeTeam})`}
            </button>
          </div>
          <Show when={tradeMsg()}>
            {(msg) => (
              <div class={`badge badge-${msg().type === 'success' ? 'success' : 'error'}`} style={{ 'margin-bottom': 'var(--space-2)', display: 'inline-block' }}>
                {msg().text}
              </div>
            )}
          </Show>
        </Show>
      </div>

      {/* Tab Content */}
      <div class="portfolio-content">
        {/* Overview Tab */}
        <Show when={activeTab() === 'overview'}>
          <div class="overview-grid">
            <Show when={currentBalance()}>
              {(balance) => (
                <>
                  <div class="stat-card">
                    <div class="stat-label">Total Equity</div>
                    <div class="stat-value">{formatCurrency(balance().total_equity)}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Cash</div>
                    <div class="stat-value">{formatCurrency(balance().cash)}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Positions Value</div>
                    <div class="stat-value">{formatCurrency(balance().positions_value)}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Total P&L</div>
                    <div class={`stat-value ${balance().total_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {balance().total_pnl >= 0 ? '+' : ''}{formatCurrency(balance().total_pnl)}
                      <span class="stat-sub">({balance().total_pnl_percent.toFixed(2)}%)</span>
                    </div>
                  </div>
                </>
              )}
            </Show>
          </div>

          {/* Quick Positions Summary */}
          <div class="card" style={{ "margin-top": "var(--space-4)" }}>
            <div class="card-header">
              <span class="card-title">Top Positions</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                <For each={(currentPositions() || []).slice(0, 5)}>
                  {(pos) => (
                    <tr>
                      <td class="mono" style={{ "font-weight": "600" }}>{pos.symbol}</td>
                      <td class="mono">{pos.quantity}</td>
                      <td class="mono">{formatCurrency(pos.entry_price)}</td>
                      <td class="mono">{formatCurrency(pos.current_price)}</td>
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
        </Show>

        {/* Positions Tab */}
        <Show when={activeTab() === 'positions'}>
          <div class="card">
            <div class="card-header">
              <span class="card-title">{settingsStore.state.activeTeam} Positions ({(currentPositions() || []).length})</span>
            </div>
            <div style={{ "max-height": "500px", "overflow-y": "auto" }}>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Quantity</th>
                    <th>Entry Price</th>
                    <th>Entry Date</th>
                    <th>Current Price</th>
                    <th>Current Value</th>
                    <th>Cost Basis</th>
                    <th>Unrealized P&L</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={currentPositions() || []}>
                    {(pos) => (
                      <tr>
                        <td class="mono" style={{ "font-weight": "600" }}>{pos.symbol}</td>
                        <td class="mono">{pos.quantity}</td>
                        <td class="mono">{formatCurrency(pos.entry_price)}</td>
                        <td>{pos.entry_date.split('T')[0]}</td>
                        <td class="mono">{formatCurrency(pos.current_price)}</td>
                        <td class="mono">{formatCurrency(pos.current_value)}</td>
                        <td class="mono">{formatCurrency(pos.cost_basis)}</td>
                        <td class={`mono ${pos.unrealized_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                          {pos.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealized_pnl)}
                          <span class="text-muted"> ({pos.unrealized_pnl_percent.toFixed(2)}%)</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                            <button
                              class="btn btn-xs btn-ghost"
                              title="Set Stop-Loss Alert (5% below)"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetStopLoss(pos.symbol, pos.current_price);
                              }}
                            >
                              SL
                            </button>
                            <button
                              class="btn btn-xs btn-ghost"
                              title="Set Take-Profit Alert (15% above)"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetTakeProfit(pos.symbol, pos.current_price);
                              }}
                            >
                              TP
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* Trades Tab */}
        <Show when={activeTab() === 'trades'}>
          <div class="card">
            <div class="card-header">
              <span class="card-title">{settingsStore.state.activeTeam} Trade History</span>
              <select
                class="input"
                style={{ width: "120px" }}
                value={tradeLimit()}
                onChange={(e) => setTradeLimit(parseInt(e.currentTarget.value))}
              >
                <option value="25">Last 25</option>
                <option value="50">Last 50</option>
                <option value="100">Last 100</option>
                <option value="500">Last 500</option>
              </select>
            </div>
            <div style={{ "max-height": "500px", "overflow-y": "auto" }}>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>P&L</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={currentTrades() || []}>
                    {(trade) => (
                      <tr>
                        <td>{trade.timestamp.split('T')[0]}</td>
                        <td class="mono" style={{ "font-weight": "600" }}>{trade.symbol}</td>
                        <td>
                          <span class={`action-badge ${trade.action.toLowerCase()}`}>
                            {trade.action}
                          </span>
                        </td>
                        <td class="mono">{trade.quantity}</td>
                        <td class="mono">{formatCurrency(trade.price)}</td>
                        <td class={`mono ${(trade.pnl || 0) >= 0 ? 'text-up' : 'text-down'}`}>
                          {trade.pnl !== null ? (
                            <>{trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}</>
                          ) : '-'}
                        </td>
                        <td class="text-muted">{trade.notes || '-'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

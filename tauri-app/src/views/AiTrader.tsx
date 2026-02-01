import { Component, For, Show, createSignal, createResource } from 'solid-js';
import { formatCurrency } from '../utils';
import {
  aiTraderGetStatus,
  aiTraderGetDecisions,
  aiTraderGetPerformanceHistory,
  aiTraderStartSession,
  aiTraderEndSession,
  aiTraderRunCycle,
  aiTraderGetPredictionAccuracy,
} from '../api';

type TabType = 'status' | 'decisions' | 'performance';

export const AiTrader: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabType>('status');
  const [isRunning, setIsRunning] = createSignal(false);
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch AI trader status
  const [statusData, { refetch: refetchStatus }] = createResource(aiTraderGetStatus);

  // Fetch recent decisions
  const [decisionsData, { refetch: refetchDecisions }] = createResource(
    () => aiTraderGetDecisions(undefined, undefined, 50)
  );

  // Fetch performance history
  const [performanceData] = createResource(() => aiTraderGetPerformanceHistory(30));

  // Fetch prediction accuracy
  const [accuracyData] = createResource(aiTraderGetPredictionAccuracy);

  const handleStartSession = async () => {
    try {
      setIsRunning(true);
      await aiTraderStartSession();
      setMessage({ type: 'success', text: 'AI trading session started' });
      refetchStatus();
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    } finally {
      setIsRunning(false);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEndSession = async () => {
    try {
      await aiTraderEndSession();
      setMessage({ type: 'success', text: 'AI trading session ended' });
      refetchStatus();
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRunCycle = async () => {
    try {
      setIsRunning(true);
      const decisions = await aiTraderRunCycle();
      setMessage({ type: 'success', text: `Cycle complete: ${decisions.length} decision(s)` });
      refetchStatus();
      refetchDecisions();
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    } finally {
      setIsRunning(false);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div class="editor-content">
      <div class="ai-trader-container">
        {/* Header */}
        <div class="ai-header">
          <h2>AI Trader (KALIC)</h2>
          <div class="ai-actions">
            <Show when={!statusData()?.current_session}>
              <button
                class="btn btn-primary"
                onClick={handleStartSession}
                disabled={isRunning()}
              >
                Start Session
              </button>
            </Show>
            <Show when={statusData()?.current_session}>
              <button
                class="btn btn-secondary"
                onClick={handleRunCycle}
                disabled={isRunning()}
              >
                {isRunning() ? 'Running...' : 'Run Cycle'}
              </button>
              <button
                class="btn btn-ghost"
                onClick={handleEndSession}
              >
                End Session
              </button>
            </Show>
          </div>
        </div>

        {/* Message */}
        <Show when={message()}>
          <div class={`alert-message ${message()!.type}`}>
            {message()!.text}
          </div>
        </Show>

        {/* Status Cards */}
        <Show when={statusData()}>
          {(status) => (
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Status</div>
                <div class={`stat-value ${status().is_running ? 'text-up' : ''}`}>
                  {status().is_running ? 'Running' : 'Stopped'}
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Portfolio Value</div>
                <div class="stat-value">{formatCurrency(status().portfolio_value)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Cash</div>
                <div class="stat-value">{formatCurrency(status().cash)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Positions</div>
                <div class="stat-value">{formatCurrency(status().positions_value)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Sessions</div>
                <div class="stat-value">{status().sessions_completed}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Trades</div>
                <div class="stat-value">{status().total_trades}</div>
              </div>
            </div>
          )}
        </Show>

        {/* Prediction Accuracy */}
        <Show when={accuracyData()}>
          {(accuracy) => (
            <div class="card" style={{ "margin-top": "var(--space-4)" }}>
              <div class="card-header">
                <span class="card-title">Prediction Accuracy</span>
              </div>
              <div class="accuracy-stats">
                <div class="accuracy-value">
                  <span class="big-number">{accuracy().accuracy_percent.toFixed(1)}%</span>
                  <span class="accuracy-label">Accuracy</span>
                </div>
                <div class="accuracy-detail">
                  <span>{accuracy().accurate_predictions} / {accuracy().total_predictions} correct</span>
                </div>
              </div>
            </div>
          )}
        </Show>

        {/* Tabs */}
        <div class="portfolio-tabs" style={{ "margin-top": "var(--space-4)" }}>
          <div class="view-tabs">
            <button
              class={`tab-btn ${activeTab() === 'decisions' ? 'active' : ''}`}
              onClick={() => setActiveTab('decisions')}
            >
              Decisions
            </button>
            <button
              class={`tab-btn ${activeTab() === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              Performance
            </button>
          </div>
        </div>

        {/* Decisions Tab */}
        <Show when={activeTab() === 'decisions'}>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Recent AI Decisions</span>
            </div>
            <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Action</th>
                    <th>Qty</th>
                    <th>Confidence</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={decisionsData() || []} fallback={
                    <tr>
                      <td colspan="6" class="text-center text-muted">No decisions yet</td>
                    </tr>
                  }>
                    {(decision) => (
                      <tr>
                        <td>{decision.timestamp.split('T')[0]}</td>
                        <td class="mono" style={{ "font-weight": "600" }}>{decision.symbol}</td>
                        <td>
                          <span class={`action-badge ${decision.action.toLowerCase()}`}>
                            {decision.action}
                          </span>
                        </td>
                        <td class="mono">{decision.quantity || '-'}</td>
                        <td>
                          <span class={`confidence-badge ${decision.confidence >= 0.7 ? 'high' : decision.confidence >= 0.4 ? 'medium' : 'low'}`}>
                            {(decision.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td class="reasoning-cell" title={decision.reasoning}>
                          {decision.reasoning.substring(0, 50)}...
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* Performance Tab */}
        <Show when={activeTab() === 'performance'}>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Performance History (30 days)</span>
            </div>
            <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Portfolio</th>
                    <th>Cash</th>
                    <th>Positions</th>
                    <th>P&L %</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={performanceData() || []} fallback={
                    <tr>
                      <td colspan="6" class="text-center text-muted">No performance data</td>
                    </tr>
                  }>
                    {(snap) => (
                      <tr>
                        <td>{snap.timestamp.split('T')[0]}</td>
                        <td class="mono">{formatCurrency(snap.portfolio_value)}</td>
                        <td class="mono">{formatCurrency(snap.cash)}</td>
                        <td class="mono">{formatCurrency(snap.positions_value)}</td>
                        <td class={`mono ${snap.total_pnl_percent >= 0 ? 'text-up' : 'text-down'}`}>
                          {snap.total_pnl_percent >= 0 ? '+' : ''}{snap.total_pnl_percent.toFixed(2)}%
                        </td>
                        <td class="mono">
                          {snap.win_rate !== null ? `${(snap.win_rate * 100).toFixed(0)}%` : '-'}
                        </td>
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

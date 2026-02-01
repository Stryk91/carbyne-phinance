import { Component, For, Show, createSignal, createResource } from 'solid-js';
import { formatCurrency } from '../utils';
import {
  getAlerts,
  addAlert,
  deleteAlert,
  checkAlerts,
} from '../api';

export const Alerts: Component = () => {
  const [showActive, setShowActive] = createSignal(true);
  const [newSymbol, setNewSymbol] = createSignal('');
  const [newPrice, setNewPrice] = createSignal('');
  const [newCondition, setNewCondition] = createSignal<'above' | 'below'>('above');
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch alerts
  const [alertsData, { refetch }] = createResource(
    () => showActive(),
    (onlyActive) => getAlerts(onlyActive)
  );

  const handleAddAlert = async () => {
    const symbol = newSymbol().toUpperCase().trim();
    const price = parseFloat(newPrice());

    if (!symbol || isNaN(price) || price <= 0) {
      setMessage({ type: 'error', text: 'Please enter valid symbol and price' });
      return;
    }

    try {
      const result = await addAlert(symbol, price, newCondition());
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setNewSymbol('');
        setNewPrice('');
        refetch();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }

    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteAlert = async (alertId: number) => {
    try {
      const result = await deleteAlert(alertId);
      if (result.success) {
        refetch();
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
  };

  const handleCheckAlerts = async () => {
    try {
      const triggered = await checkAlerts();
      if (triggered.length > 0) {
        setMessage({ type: 'success', text: `${triggered.length} alert(s) triggered!` });
      } else {
        setMessage({ type: 'success', text: 'No alerts triggered' });
      }
      refetch();
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const activeAlerts = () => (alertsData() || []).filter(a => !a.triggered);

  return (
    <div class="editor-content">
      <div class="alerts-container">
        {/* Header */}
        <div class="alerts-header">
          <h2>Price Alerts</h2>
          <div class="alerts-actions">
            <button class="btn btn-primary" onClick={handleCheckAlerts}>
              Check All Alerts
            </button>
          </div>
        </div>

        {/* Message */}
        <Show when={message()}>
          <div class={`alert-message ${message()!.type}`}>
            {message()!.text}
          </div>
        </Show>

        {/* Add Alert Form */}
        <div class="card" style={{ "margin-bottom": "var(--space-4)" }}>
          <div class="card-header">
            <span class="card-title">Create New Alert</span>
          </div>
          <div class="alert-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Symbol</label>
                <input
                  type="text"
                  class="input"
                  placeholder="AAPL"
                  value={newSymbol()}
                  onInput={(e) => setNewSymbol(e.currentTarget.value)}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Condition</label>
                <select
                  class="input"
                  value={newCondition()}
                  onChange={(e) => setNewCondition(e.currentTarget.value as 'above' | 'below')}
                >
                  <option value="above">Price Above</option>
                  <option value="below">Price Below</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Target Price</label>
                <input
                  type="number"
                  class="input"
                  placeholder="150.00"
                  step="0.01"
                  value={newPrice()}
                  onInput={(e) => setNewPrice(e.currentTarget.value)}
                />
              </div>
              <div class="form-group" style={{ "align-self": "flex-end" }}>
                <button class="btn btn-primary" onClick={handleAddAlert}>
                  Add Alert
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div class="filter-tabs">
          <button
            class={`tab-btn ${showActive() ? 'active' : ''}`}
            onClick={() => setShowActive(true)}
          >
            Active ({activeAlerts().length})
          </button>
          <button
            class={`tab-btn ${!showActive() ? 'active' : ''}`}
            onClick={() => setShowActive(false)}
          >
            All Alerts
          </button>
        </div>

        {/* Alerts List */}
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Condition</th>
                <th>Target Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={alertsData() || []} fallback={
                <tr>
                  <td colspan="5" class="text-center text-muted">No alerts found</td>
                </tr>
              }>
                {(alert) => (
                  <tr class={alert.triggered ? 'triggered' : ''}>
                    <td class="mono" style={{ "font-weight": "600" }}>{alert.symbol}</td>
                    <td>
                      <span class={`condition-badge ${alert.condition}`}>
                        {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </td>
                    <td class="mono">{formatCurrency(alert.target_price)}</td>
                    <td>
                      <span class={`status-badge ${alert.triggered ? 'triggered' : 'active'}`}>
                        {alert.triggered ? 'Triggered' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <button
                        class="btn btn-icon btn-ghost"
                        onClick={() => handleDeleteAlert(alert.id)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
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

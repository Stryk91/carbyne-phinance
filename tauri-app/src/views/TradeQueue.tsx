import { Component, For, Show, createSignal, createResource, onMount, onCleanup } from 'solid-js';
import { formatCurrency } from '../utils';
import { getTradeQueue, cancelQueuedTrade, getSchedulerStatus, type QueuedTrade } from '../api';

type QueueTab = 'pending' | 'executed' | 'all';

export const TradeQueue: Component = () => {
  const [activeTab, setActiveTab] = createSignal<QueueTab>('pending');

  // Fetch queue data based on active tab
  const fetchQueue = async (tab: QueueTab): Promise<QueuedTrade[]> => {
    if (tab === 'pending') return getTradeQueue('queued');
    if (tab === 'executed') return getTradeQueue('executed');
    return getTradeQueue();
  };

  const [queueData, { refetch: refetchQueue }] = createResource(
    () => activeTab(),
    fetchQueue
  );

  const [schedulerData, { refetch: refetchScheduler }] = createResource(getSchedulerStatus);

  const refreshAll = () => {
    refetchQueue();
    refetchScheduler();
  };

  // Auto-refresh every 15 seconds
  let refreshInterval: number | undefined;

  onMount(() => {
    refreshInterval = window.setInterval(refreshAll, 15000);
  });

  onCleanup(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
    }
  });

  const handleCancel = async (id: number) => {
    try {
      await cancelQueuedTrade(id);
      refetchQueue();
    } catch (e) {
      console.error('Failed to cancel trade:', e);
    }
  };

  const trades = () => queueData() || [];
  const scheduler = () => schedulerData();

  const statusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'var(--color-warning)';
      case 'executing': return 'var(--color-info, #58a6ff)';
      case 'executed': return 'var(--color-success)';
      case 'failed': return 'var(--color-error)';
      case 'cancelled': return 'var(--text-muted)';
      default: return 'var(--text-secondary)';
    }
  };

  const actionColor = (action: string) => {
    return action === 'BUY' ? 'var(--price-up)' : 'var(--price-down)';
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div class="view-container" style={{ padding: 'var(--space-4)', overflow: 'auto' }}>
      {/* Scheduler Status Bar */}
      <div style={{
        display: 'flex',
        'align-items': 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--bg-overlay)',
        border: '1px solid var(--border-primary)',
        'border-radius': 'var(--radius-md)',
        'margin-bottom': 'var(--space-4)',
        'font-size': '12px',
      }}>
        <Show when={scheduler()} fallback={<span style={{ color: 'var(--text-muted)' }}>Loading scheduler...</span>}>
          {(s) => (
            <>
              <span style={{
                display: 'inline-flex',
                'align-items': 'center',
                gap: '6px',
                color: s().running ? 'var(--color-success)' : 'var(--color-error)',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  'border-radius': '50%',
                  background: s().running ? 'var(--color-success)' : 'var(--color-error)',
                  display: 'inline-block',
                }} />
                Scheduler {s().running ? 'Active' : 'Inactive'}
              </span>
              <span style={{ color: 'var(--border-secondary)', 'user-select': 'none' }}>|</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                ET: {s().current_et_time}
              </span>
              <span style={{ color: 'var(--border-secondary)', 'user-select': 'none' }}>|</span>
              <span style={{
                color: s().market_open ? 'var(--color-success)' : 'var(--text-muted)',
              }}>
                Market {s().market_open ? 'Open' : 'Closed'}
              </span>
              <span style={{ color: 'var(--border-secondary)', 'user-select': 'none' }}>|</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Next open: {s().next_market_open}
              </span>
              <span style={{ color: 'var(--border-secondary)', 'user-select': 'none' }}>|</span>
              <span style={{ color: 'var(--color-warning)' }}>
                {s().queued_count} queued
              </span>
            </>
          )}
        </Show>
        <div style={{ 'margin-left': 'auto' }}>
          <button
            class="btn btn-ghost"
            style={{ 'font-size': '11px', padding: '2px 8px' }}
            onClick={refreshAll}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '0',
        'border-bottom': '1px solid var(--border-primary)',
        'margin-bottom': 'var(--space-4)',
      }}>
        {(['pending', 'executed', 'all'] as QueueTab[]).map((tab) => (
          <button
            class="btn btn-ghost"
            style={{
              'border-radius': '0',
              'border-bottom': activeTab() === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab() === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              'font-size': '12px',
              padding: 'var(--space-2) var(--space-4)',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'pending' ? 'Pending' : tab === 'executed' ? 'Executed' : 'All'}
          </button>
        ))}
      </div>

      {/* Queue Table */}
      <Show when={!queueData.loading} fallback={
        <div style={{ color: 'var(--text-muted)', 'text-align': 'center', padding: 'var(--space-6)' }}>
          Loading queue...
        </div>
      }>
        <Show when={trades().length > 0} fallback={
          <div style={{
            color: 'var(--text-muted)',
            'text-align': 'center',
            padding: 'var(--space-6)',
            'font-size': '13px',
          }}>
            No {activeTab() === 'all' ? '' : activeTab() + ' '}trades in queue
          </div>
        }>
          <table style={{
            width: '100%',
            'border-collapse': 'collapse',
            'font-size': '12px',
          }}>
            <thead>
              <tr style={{
                'border-bottom': '1px solid var(--border-primary)',
                color: 'var(--text-muted)',
                'text-align': 'left',
              }}>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Status</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Portfolio</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Action</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Symbol</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500, 'text-align': 'right' }}>Qty</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500, 'text-align': 'right' }}>Target</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500, 'text-align': 'right' }}>Exec Price</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Conv.</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Queued</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}>Reasoning</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', 'font-weight': 500 }}></th>
              </tr>
            </thead>
            <tbody>
              <For each={trades()}>
                {(trade) => (
                  <tr style={{
                    'border-bottom': '1px solid var(--border-subtle, var(--border-primary))',
                  }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <span style={{
                        color: statusColor(trade.status),
                        'font-weight': 600,
                        'text-transform': 'uppercase',
                        'font-size': '10px',
                        'letter-spacing': '0.5px',
                      }}>
                        {trade.status}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-secondary)' }}>
                      {trade.portfolio}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <span style={{ color: actionColor(trade.action), 'font-weight': 600 }}>
                        {trade.action}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-primary)', 'font-weight': 500 }}>
                      {trade.symbol}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', 'text-align': 'right', color: 'var(--text-secondary)' }}>
                      {trade.quantity}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', 'text-align': 'right', color: 'var(--text-secondary)' }}>
                      {trade.target_price ? formatCurrency(trade.target_price) : '-'}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', 'text-align': 'right', color: 'var(--text-primary)' }}>
                      {trade.execution_price ? formatCurrency(trade.execution_price) : '-'}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', 'text-align': 'center' }}>
                      <Show when={trade.conviction} fallback={<span style={{ color: 'var(--text-muted)' }}>-</span>}>
                        <span style={{
                          color: (trade.conviction || 0) >= 8 ? 'var(--color-success)' : (trade.conviction || 0) >= 5 ? 'var(--color-warning)' : 'var(--text-secondary)',
                          'font-weight': 600,
                        }}>
                          {trade.conviction}
                        </span>
                      </Show>
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', 'font-size': '11px' }}>
                      {formatTime(trade.created_at)}
                    </td>
                    <td style={{
                      padding: 'var(--space-2) var(--space-3)',
                      color: 'var(--text-muted)',
                      'font-size': '11px',
                      'max-width': '200px',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                      title={trade.reasoning || ''}
                    >
                      {trade.reasoning || '-'}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <Show when={trade.status === 'queued'}>
                        <button
                          class="btn btn-ghost"
                          style={{
                            'font-size': '10px',
                            padding: '1px 6px',
                            color: 'var(--color-error)',
                            border: '1px solid var(--color-error)',
                          }}
                          onClick={() => handleCancel(trade.id)}
                        >
                          Cancel
                        </button>
                      </Show>
                      <Show when={trade.status === 'failed'}>
                        <span style={{ color: 'var(--color-error)', 'font-size': '10px' }}
                          title={trade.error_message || ''}
                        >
                          {trade.error_message ? trade.error_message.substring(0, 30) : 'Error'}
                        </span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </Show>
    </div>
  );
};

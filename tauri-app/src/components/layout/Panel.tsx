import { Component, For, Show } from 'solid-js';
import { appStore, PanelTab } from '../../stores';
import { formatTime } from '../../utils';

interface LogEntry {
  time: Date;
  level: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

const sampleLogs: LogEntry[] = [
  { time: new Date(), level: 'success', message: 'Fetched prices for 156 symbols' },
  { time: new Date(Date.now() - 16000), level: 'info', message: 'Auto-refresh triggered for favorites' },
  { time: new Date(Date.now() - 93000), level: 'warn', message: 'API rate limit: 23/25 calls used today' },
  { time: new Date(Date.now() - 207000), level: 'info', message: 'AI Trader session started - analyzing 24 positions' },
  { time: new Date(Date.now() - 432000), level: 'error', message: 'Failed to fetch FRED data: Connection timeout' },
];

const tabs: { id: PanelTab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'ai-chat', label: 'AI Chat' },
];

export const Panel: Component = () => {
  const handleTabClick = (tab: PanelTab) => {
    appStore.setPanelTab(tab);
  };

  return (
    <Show when={!appStore.state.panelCollapsed}>
      <div class="panel" style={{ height: `${appStore.state.panelHeight}px` }}>
        <div class="panel-header">
          <div class="panel-tabs">
            <For each={tabs}>
              {(tab) => (
                <button
                  class={`panel-tab ${appStore.state.panelTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button class="btn btn-icon btn-ghost" title="Clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-ghost" title="Minimize" onClick={() => appStore.togglePanel()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="panel-content">
          <Show when={appStore.state.panelTab === 'log'}>
            <For each={sampleLogs}>
              {(entry) => (
                <div class="log-entry">
                  <span class="log-time">{formatTime(entry.time)}</span>
                  <span class={`log-level ${entry.level}`}>{entry.level.toUpperCase()}</span>
                  <span class="log-message">{entry.message}</span>
                </div>
              )}
            </For>
          </Show>
          <Show when={appStore.state.panelTab === 'alerts'}>
            <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-2)' }}>
              3 active alerts
            </div>
          </Show>
          <Show when={appStore.state.panelTab === 'ai-chat'}>
            <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-2)' }}>
              AI Chat interface
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
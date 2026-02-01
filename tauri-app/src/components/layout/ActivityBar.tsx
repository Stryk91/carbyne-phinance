import { Component, For, createResource, onMount, onCleanup } from 'solid-js';
import { appStore, ViewType } from '../../stores';
import { getAlerts, getSymbols, getPendingQueueCount, type Alert } from '../../api';

interface ActivityItem {
  id: ViewType;
  icon: string;
  title: string;
}

const topItems: ActivityItem[] = [
  { id: 'dashboard', icon: 'dashboard', title: 'Dashboard' },
  { id: 'symbols', icon: 'trending', title: 'Symbols' },
  { id: 'charts', icon: 'chart', title: 'Charts' },
  { id: 'portfolio', icon: 'portfolio', title: 'Portfolio' },
  { id: 'ai-trader', icon: 'ai', title: 'AI Trader' },
  { id: 'trade-queue', icon: 'queue', title: 'Trade Queue' },
  { id: 'alerts', icon: 'bell', title: 'Alerts' },
  { id: 'reports', icon: 'reports', title: 'Reports' },
];

const bottomItems: ActivityItem[] = [
  { id: 'settings', icon: 'settings', title: 'Settings' },
];

const icons: Record<string, string> = {
  dashboard: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  trending: `<polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/>`,
  chart: `<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="12" y="6" width="3" height="12"/><rect x="17" y="12" width="3" height="6"/>`,
  portfolio: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>`,
  ai: `<path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M6 10v2a6 6 0 0 0 12 0v-2"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>`,
  queue: `<path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><line x1="10" y1="14" x2="21" y2="3"/>`,
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  reports: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
};

export const ActivityBar: Component = () => {
  // Fetch active alerts (triggered)
  const [alertsData, { refetch: refetchAlerts }] = createResource(() => getAlerts(true));

  // Fetch symbols for count
  const [symbolsData, { refetch: refetchSymbols }] = createResource(getSymbols);

  // Fetch pending queue count
  const [queueCountData, { refetch: refetchQueueCount }] = createResource(getPendingQueueCount);

  // Get triggered alert count
  const triggeredAlertCount = () => {
    const alerts = alertsData();
    if (!alerts) return 0;
    return alerts.filter((a: Alert) => a.triggered).length;
  };

  // Get symbol count
  const symbolCount = () => {
    const symbols = symbolsData();
    return symbols?.length || 0;
  };

  // Get pending queue count
  const queueCount = () => {
    const data = queueCountData();
    return data?.count || 0;
  };

  // Auto-refresh counts every 30 seconds
  let refreshInterval: number | undefined;

  onMount(() => {
    refreshInterval = window.setInterval(() => {
      refetchAlerts();
      refetchSymbols();
      refetchQueueCount();
    }, 30000);
  });

  onCleanup(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
    }
  });

  const handleClick = (id: ViewType) => {
    appStore.setView(id);
  };

  // Get dynamic badge for item
  const getBadge = (id: ViewType): { count: number; type: 'default' | 'error' } | null => {
    if (id === 'alerts') {
      const count = triggeredAlertCount();
      return count > 0 ? { count, type: 'error' } : null;
    }
    if (id === 'symbols') {
      const count = symbolCount();
      return count > 0 ? { count, type: 'default' } : null;
    }
    if (id === 'trade-queue') {
      const count = queueCount();
      return count > 0 ? { count, type: 'error' } : null;
    }
    return null;
  };

  return (
    <nav class="activity-bar">
      <div class="activity-bar-top">
        <For each={topItems}>
          {(item) => {
            const badge = () => getBadge(item.id);
            return (
              <button
                class={`activity-item ${appStore.state.activeView === item.id ? 'active' : ''}`}
                title={item.title}
                onClick={() => handleClick(item.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" innerHTML={icons[item.icon]} />
                {badge() && (
                  <span
                    class="activity-badge"
                    style={badge()!.type === 'error' ? { background: 'var(--color-error)' } : {}}
                  >
                    {badge()!.count > 99 ? '99+' : badge()!.count}
                  </span>
                )}
              </button>
            );
          }}
        </For>
      </div>
      <div class="activity-bar-bottom">
        <For each={bottomItems}>
          {(item) => (
            <button
              class={`activity-item ${appStore.state.activeView === item.id ? 'active' : ''}`}
              title={item.title}
              onClick={() => handleClick(item.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" innerHTML={icons[item.icon]} />
            </button>
          )}
        </For>
      </div>
    </nav>
  );
};
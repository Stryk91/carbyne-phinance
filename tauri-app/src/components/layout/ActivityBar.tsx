import { Component, For } from 'solid-js';
import { appStore, ViewType } from '../../stores';

interface ActivityItem {
  id: ViewType;
  icon: string;
  title: string;
  badge?: number;
  badgeType?: 'default' | 'error';
}

const topItems: ActivityItem[] = [
  { id: 'dashboard', icon: 'dashboard', title: 'Dashboard' },
  { id: 'symbols', icon: 'trending', title: 'Symbols', badge: 156 },
  { id: 'charts', icon: 'chart', title: 'Charts' },
  { id: 'portfolio', icon: 'portfolio', title: 'Portfolio' },
  { id: 'ai-trader', icon: 'ai', title: 'AI Trader' },
  { id: 'alerts', icon: 'bell', title: 'Alerts', badge: 3, badgeType: 'error' },
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
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
};

export const ActivityBar: Component = () => {
  const handleClick = (id: ViewType) => {
    appStore.setView(id);
  };

  return (
    <nav class="activity-bar">
      <div class="activity-bar-top">
        <For each={topItems}>
          {(item) => (
            <button
              class={`activity-item ${appStore.state.activeView === item.id ? 'active' : ''}`}
              title={item.title}
              onClick={() => handleClick(item.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" innerHTML={icons[item.icon]} />
              {item.badge && (
                <span 
                  class="activity-badge" 
                  style={item.badgeType === 'error' ? { background: 'var(--color-error)' } : {}}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )}
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
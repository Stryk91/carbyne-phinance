import { Component, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import { TitleBar, ActivityBar, Sidebar, Panel, StatusBar } from './components/layout';
import { CommandPalette } from './components/navigation';
import { Dashboard } from './views';
import { appStore, setupKeyboardShortcuts, symbolStore } from './stores';
import './styles/index.css';

const App: Component = () => {
  let cleanupShortcuts: (() => void) | undefined;

  onMount(() => {
    // Setup keyboard shortcuts
    cleanupShortcuts = setupKeyboardShortcuts();
    
    // Initialize with a default selected symbol
    if (!symbolStore.state.selectedSymbol) {
      symbolStore.selectSymbol('AAPL');
    }
  });

  onCleanup(() => {
    if (cleanupShortcuts) {
      cleanupShortcuts();
    }
  });

  // Get the current view icon based on active view
  const getViewIcon = () => {
    switch (appStore.state.activeView) {
      case 'dashboard':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        );
      case 'charts':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/>
          </svg>
        );
      case 'portfolio':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        );
      case 'ai-trader':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M12 12v10"/><path d="M8 22h8"/>
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        );
    }
  };

  const getViewTitle = () => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      symbols: 'Symbols',
      charts: 'Charts',
      portfolio: 'Portfolio',
      'ai-trader': 'AI Trader',
      alerts: 'Alerts',
      settings: 'Settings',
    };
    return titles[appStore.state.activeView] || 'Dashboard';
  };

  return (
    <div class="app-container">
      <TitleBar />
      <ActivityBar />
      <Sidebar />
      
      <main class="main-content">
        <div class="editor-tabs">
          <button class="editor-tab active">
            {getViewIcon()}
            {getViewTitle()}
            {symbolStore.state.selectedSymbol && appStore.state.activeView === 'dashboard' && (
              <span class="editor-tab-symbol">— {symbolStore.state.selectedSymbol}</span>
            )}
          </button>
        </div>
        
        <Switch fallback={<Dashboard />}>
          <Match when={appStore.state.activeView === 'dashboard'}>
            <Dashboard />
          </Match>
          <Match when={appStore.state.activeView === 'symbols'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                Symbols view - implementation pending
              </div>
            </div>
          </Match>
          <Match when={appStore.state.activeView === 'charts'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                Charts view - implementation pending
              </div>
            </div>
          </Match>
          <Match when={appStore.state.activeView === 'portfolio'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                Portfolio view - implementation pending
              </div>
            </div>
          </Match>
          <Match when={appStore.state.activeView === 'ai-trader'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                AI Trader view - implementation pending
              </div>
            </div>
          </Match>
          <Match when={appStore.state.activeView === 'alerts'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                Alerts view - implementation pending
              </div>
            </div>
          </Match>
          <Match when={appStore.state.activeView === 'settings'}>
            <div class="editor-content">
              <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>
                Settings view - implementation pending
              </div>
            </div>
          </Match>
        </Switch>
        
        <Panel />
      </main>
      
      <StatusBar />
      <CommandPalette />
    </div>
  );
};

export default App;
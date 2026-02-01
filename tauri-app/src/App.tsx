import { Component, Switch, Match, onMount, onCleanup } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ActivityBar, Sidebar, Panel, StatusBar } from './components/layout';
import { addLog, addOutput, addProblem } from './components/layout/Panel';
import { CommandPalette } from './components/navigation';
import { NewsDetail } from './components/NewsDetail';
import { Dashboard, Charts, Symbols, Portfolio, AiTrader, TradeQueue, Alerts, Reports, Settings } from './views';
import { appStore, setupKeyboardShortcuts, symbolStore } from './stores';
import './styles/index.css';

const App: Component = () => {
  let cleanupShortcuts: (() => void) | undefined;
  let unlistenFns: UnlistenFn[] = [];

  onMount(async () => {
    // Setup keyboard shortcuts
    cleanupShortcuts = setupKeyboardShortcuts();

    // Initialize with a default selected symbol
    if (!symbolStore.state.selectedSymbol) {
      symbolStore.selectSymbol('AAPL');
    }

    // Log app startup
    addLog('App initialized', 'output');
    addOutput('System', 'Application started');

    // Listen for Tauri backend events
    try {
      // Listen for log events from backend
      unlistenFns.push(await listen<{ message: string; level: string }>('app-log', (event) => {
        const { message, level } = event.payload;
        if (level === 'error') {
          addLog(`[BACKEND] ${message}`, 'error');
          addProblem('error', message, 'Backend');
        } else if (level === 'warning') {
          addLog(`[BACKEND] ${message}`, 'output');
          addProblem('warning', message, 'Backend');
        } else {
          addLog(`[BACKEND] ${message}`, 'output');
        }
      }));

      // Listen for trade execution events
      unlistenFns.push(await listen<{ action: string; symbol: string; quantity: number; price: number }>('trade-executed', (event) => {
        const { action, symbol, quantity, price } = event.payload;
        addLog(`[TRADE] ${action} ${quantity} ${symbol} @ $${price.toFixed(2)}`, 'output');
        addOutput('Trading', `${action} ${quantity} ${symbol} @ $${price.toFixed(2)}`);
      }));

      // Listen for price updates
      unlistenFns.push(await listen<{ symbol: string; price: number }>('price-update', (event) => {
        const { symbol, price } = event.payload;
        addOutput('Market Data', `${symbol}: $${price.toFixed(2)}`);
      }));

      // Listen for alert triggers
      unlistenFns.push(await listen<{ symbol: string; condition: string; target_price: number }>('alert-triggered', (event) => {
        const { symbol, condition, target_price } = event.payload;
        addLog(`[ALERT] ${symbol} ${condition} $${target_price.toFixed(2)}`, 'output');
        addOutput('Alerts', `${symbol} hit ${condition} $${target_price.toFixed(2)}`);
        addProblem('warning', `Alert: ${symbol} ${condition} $${target_price}`, 'Price Alerts');
      }));
    } catch (e) {
      // Not running in Tauri context
      addLog('Running in browser mode', 'output');
    }
  });

  onCleanup(() => {
    if (cleanupShortcuts) {
      cleanupShortcuts();
    }
    // Cleanup all Tauri event listeners
    unlistenFns.forEach(fn => fn());
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
      'trade-queue': 'Trade Queue',
      alerts: 'Alerts',
      settings: 'Settings',
    };
    return titles[appStore.state.activeView] || 'Dashboard';
  };

  return (
    <div class="app-container">
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
            <Symbols />
          </Match>
          <Match when={appStore.state.activeView === 'charts'}>
            <Charts />
          </Match>
          <Match when={appStore.state.activeView === 'portfolio'}>
            <Portfolio />
          </Match>
          <Match when={appStore.state.activeView === 'ai-trader'}>
            <AiTrader />
          </Match>
          <Match when={appStore.state.activeView === 'trade-queue'}>
            <TradeQueue />
          </Match>
          <Match when={appStore.state.activeView === 'alerts'}>
            <Alerts />
          </Match>
          <Match when={appStore.state.activeView === 'reports'}>
            <Reports />
          </Match>
          <Match when={appStore.state.activeView === 'settings'}>
            <Settings />
          </Match>
        </Switch>
        
        <Panel />
      </main>
      
      <StatusBar />
      <CommandPalette />
      <NewsDetail />
    </div>
  );
};

export default App;
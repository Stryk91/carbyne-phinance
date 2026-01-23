import { Component, Switch, Match } from 'solid-js';
import { TitleBar, ActivityBar, Sidebar, Panel, StatusBar } from './components/layout';
import { CommandPalette } from './components/navigation';
import { Dashboard } from './views';
import { appStore } from './stores';
import './styles/index.css';

const App: Component = () => {
  return (
    <div class="app-container">
      <TitleBar />
      <ActivityBar />
      <Sidebar />
      
      <main class="main-content">
        <div class="editor-tabs">
          <button class="editor-tab active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Dashboard
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
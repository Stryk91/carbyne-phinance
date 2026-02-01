import { Component, For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { appStore } from '../../stores';
import {
  getSymbols,
  getPortfolio,
  fetchPrices,
  getAlerts,
  checkAlerts,
} from '../../api';

export type PanelTab = 'activity' | 'problems' | 'output';

interface LogEntry {
  id: number;
  time: Date;
  message: string;
  type?: 'command' | 'output' | 'error';
}

interface Problem {
  id: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
  timestamp: Date;
}

interface OutputMessage {
  id: number;
  channel: string;
  message: string;
  timestamp: Date;
}

// Activity log state - captures all app events
const [activityLogs, setActivityLogs] = createSignal<LogEntry[]>([
  { id: 1, time: new Date(), message: 'Ready', type: 'output' },
]);

// Problems state - starts empty, populated by real errors
const [problems, setProblems] = createSignal<Problem[]>([]);

// Output state - starts empty, populated by real events
const [outputMessages, setOutputMessages] = createSignal<OutputMessage[]>([]);

let activityRef: HTMLDivElement | undefined;

// Scroll activity log to bottom when new entries added
const scrollActivityToBottom = () => {
  if (activityRef) {
    activityRef.scrollTop = activityRef.scrollHeight;
  }
};

// Helper to add log entry - EXPORTED for other components
let logIdCounter = 3;
export const addLog = (message: string, type: 'command' | 'output' | 'error' = 'output') => {
  setActivityLogs(prev => [...prev, { id: logIdCounter++, time: new Date(), message, type }]);
  // Auto-scroll after adding
  setTimeout(scrollActivityToBottom, 10);
};

// Helper to add output message - EXPORTED for other components
let outputIdCounter = 1;
export const addOutput = (channel: string, message: string) => {
  setOutputMessages(prev => [...prev, { id: outputIdCounter++, channel, message, timestamp: new Date() }]);
};

// Helper to add problem
let problemIdCounter = 1;
export const addProblem = (severity: 'error' | 'warning' | 'info', message: string, source: string) => {
  setProblems(prev => [...prev, { id: problemIdCounter++, severity, message, source, timestamp: new Date() }]);
};

const [activeTab, setActiveTab] = createSignal<PanelTab>('activity');
const [commandInput, setCommandInput] = createSignal('');
let inputRef: HTMLInputElement | undefined;

const tabs: { id: PanelTab; label: string; badge?: () => number }[] = [
  { id: 'activity', label: 'ACTIVITY' },
  { id: 'problems', label: 'PROBLEMS', badge: () => problems().filter(p => p.severity === 'error').length },
  { id: 'output', label: 'OUTPUT' },
];

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const handleCommandSubmit = async (e: Event) => {
  e.preventDefault();
  const cmd = commandInput().trim();
  if (!cmd) return;

  addLog(`> ${cmd}`, 'command');
  setCommandInput('');

  const parts = cmd.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (command) {
      case 'help':
        addLog('Available commands:');
        addLog('  help                    - Show this help');
        addLog('  clear                   - Clear activity log');
        addLog('  status                  - Show system status');
        addLog('  symbols                 - List all symbols');
        addLog('  positions               - Show portfolio positions');
        addLog('  fetch <symbols>         - Fetch prices (e.g., fetch AAPL,NVDA)');
        addLog('  refresh                 - Refresh all favorited symbols');
        addLog('  alerts                  - Check and list active alerts');
        break;

      case 'clear':
        setActivityLogs([]);
        break;

      case 'status':
        addLog('Fetching status...', 'output');
        try {
          const symbols = await getSymbols();
          const portfolio = await getPortfolio();
          addLog(`Symbols: ${symbols.length} loaded`);
          addLog(`Positions: ${portfolio.positions.length} active`);
          addLog(`Total P&L: $${portfolio.total_profit_loss.toFixed(2)}`);
          addOutput('System', `Status check: ${symbols.length} symbols, ${portfolio.positions.length} positions`);
        } catch (err) {
          addLog(`Error: ${err}`, 'error');
          addProblem('error', `Status check failed: ${err}`, 'Terminal');
        }
        break;

      case 'symbols':
        try {
          const symbols = await getSymbols();
          addLog(`Loaded ${symbols.length} symbols:`);
          const top10 = symbols.slice(0, 10);
          top10.forEach(s => {
            const direction = s.change_direction === 'up' ? '+' : s.change_direction === 'down' ? '' : ' ';
            addLog(`  ${s.symbol.padEnd(6)} $${s.price.toFixed(2).padStart(8)} ${direction}${s.change_percent.toFixed(2)}%`);
          });
          if (symbols.length > 10) addLog(`  ... and ${symbols.length - 10} more`);
        } catch (err) {
          addLog(`Error: ${err}`, 'error');
        }
        break;

      case 'positions':
        try {
          const portfolio = await getPortfolio();
          if (portfolio.positions.length === 0) {
            addLog('No positions found');
          } else {
            addLog(`Portfolio (${portfolio.positions.length} positions):`);
            portfolio.positions.forEach((p: any) => {
              const pnlSign = p.unrealized_pnl >= 0 ? '+' : '';
              addLog(`  ${p.symbol.padEnd(6)} ${p.quantity} @ $${p.avg_cost.toFixed(2)} | P&L: ${pnlSign}$${p.unrealized_pnl.toFixed(2)}`);
            });
            addLog(`Total P&L: $${portfolio.total_profit_loss.toFixed(2)}`);
          }
        } catch (err) {
          addLog(`Error: ${err}`, 'error');
        }
        break;

      case 'fetch':
        if (args.length === 0) {
          addLog('Usage: fetch <symbols>  (e.g., fetch AAPL,NVDA,TSLA)', 'error');
        } else {
          const symbols = args.join(',').toUpperCase();
          addLog(`Fetching prices for: ${symbols}...`);
          try {
            const result = await fetchPrices(symbols, '1mo');
            addLog(result.message);
            addOutput('Market Data', `Fetched: ${symbols}`);
          } catch (err) {
            addLog(`Error: ${err}`, 'error');
            addProblem('error', `Fetch failed: ${err}`, 'Yahoo Finance');
          }
        }
        break;

      case 'refresh':
        addLog('Refreshing favorited symbols...');
        try {
          const symbols = await getSymbols();
          const favorited = symbols.filter(s => s.favorited).map(s => s.symbol);
          if (favorited.length === 0) {
            addLog('No favorited symbols to refresh');
          } else {
            addLog(`Refreshing ${favorited.length} symbols: ${favorited.join(', ')}`);
            const result = await fetchPrices(favorited.join(','), '1d');
            addLog(result.message);
            addOutput('Market Data', `Refreshed ${favorited.length} symbols`);
          }
        } catch (err) {
          addLog(`Error: ${err}`, 'error');
        }
        break;

      case 'alerts':
        try {
          const triggeredAlerts = await checkAlerts();
          if (triggeredAlerts.length > 0) {
            addLog(`${triggeredAlerts.length} alerts triggered!`);
          }
          const alerts = await getAlerts(true);
          if (alerts.length === 0) {
            addLog('No active alerts');
          } else {
            addLog(`Active alerts (${alerts.length}):`);
            alerts.forEach((a: any) => {
              addLog(`  ${a.symbol}: ${a.condition} $${a.target_price}`);
            });
          }
        } catch (err) {
          addLog(`Error: ${err}`, 'error');
        }
        break;

      default:
        addLog(`Unknown command: ${command}. Type 'help' for available commands.`, 'error');
    }
  } catch (err) {
    addLog(`Error executing command: ${err}`, 'error');
    addProblem('error', `Command failed: ${cmd}`, 'Terminal');
  }
};

const clearProblems = () => {
  setProblems([]);
};

const clearOutput = () => {
  setOutputMessages([]);
};

export const Panel: Component = () => {
  // Focus activity input when activity tab is active
  const focusActivityInput = () => {
    if (activeTab() === 'activity' && inputRef) {
      inputRef.focus();
    }
  };

  // Expose focus function globally for keyboard shortcut
  onMount(() => {
    (window as any).__focusActivityInput = focusActivityInput;
  });

  onCleanup(() => {
    delete (window as any).__focusActivityInput;
  });

  return (
    <Show when={!appStore.state.panelCollapsed}>
      <div class="panel" style={{ height: `${appStore.state.panelHeight}px` }}>
        <div class="panel-header">
          <div class="panel-tabs">
            <For each={tabs}>
              {(tab) => (
                <button
                  class={`panel-tab ${activeTab() === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  <Show when={tab.badge && tab.badge() > 0}>
                    <span class="panel-tab-badge">{tab.badge!()}</span>
                  </Show>
                </button>
              )}
            </For>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Show when={activeTab() === 'activity'}>
              <button class="btn btn-icon btn-ghost" title="Clear Activity" onClick={() => setActivityLogs([])}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
              </button>
            </Show>
            <Show when={activeTab() === 'problems'}>
              <button class="btn btn-icon btn-ghost" title="Clear Problems" onClick={clearProblems}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
              </button>
            </Show>
            <Show when={activeTab() === 'output'}>
              <button class="btn btn-icon btn-ghost" title="Clear Output" onClick={clearOutput}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
              </button>
            </Show>
            <button class="btn btn-icon btn-ghost" title="Maximize Panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-ghost" title="Close Panel" onClick={() => appStore.togglePanel()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="panel-content">
          {/* TERMINAL Tab */}
          <Show when={activeTab() === 'activity'}>
            <div class="activity-container">
              <div class="activity-output" ref={activityRef} onClick={focusActivityInput}>
                <For each={activityLogs()}>
                  {(entry) => (
                    <div class={`activity-line ${entry.type || ''}`}>
                      <span class="activity-time">[{formatTime(entry.time)}]</span>
                      <span class="activity-message">{entry.message}</span>
                    </div>
                  )}
                </For>
              </div>
              <form class="activity-input-row" onSubmit={handleCommandSubmit}>
                <span class="activity-prompt">›</span>
                <input
                  ref={inputRef}
                  type="text"
                  class="activity-input"
                  value={commandInput()}
                  onInput={(e) => setCommandInput(e.currentTarget.value)}
                  placeholder="Type a command..."
                  spellcheck={false}
                  autocomplete="off"
                />
              </form>
            </div>
          </Show>

          {/* PROBLEMS Tab */}
          <Show when={activeTab() === 'problems'}>
            <div class="problems-container">
              <Show when={problems().length === 0}>
                <div class="problems-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>No problems detected</span>
                </div>
              </Show>
              <For each={problems()}>
                {(problem) => (
                  <div class={`problem-item ${problem.severity}`}>
                    <div class="problem-icon">
                      <Show when={problem.severity === 'error'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15" stroke="var(--bg-base)" stroke-width="2"/>
                          <line x1="9" y1="9" x2="15" y2="15" stroke="var(--bg-base)" stroke-width="2"/>
                        </svg>
                      </Show>
                      <Show when={problem.severity === 'warning'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 22h20L12 2z"/>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="var(--bg-base)" stroke-width="2"/>
                          <circle cx="12" cy="17" r="1" fill="var(--bg-base)"/>
                        </svg>
                      </Show>
                      <Show when={problem.severity === 'info'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="16" x2="12" y2="12" stroke="var(--bg-base)" stroke-width="2"/>
                          <circle cx="12" cy="8" r="1" fill="var(--bg-base)"/>
                        </svg>
                      </Show>
                    </div>
                    <div class="problem-content">
                      <span class="problem-message">{problem.message}</span>
                      <span class="problem-source">{problem.source}</span>
                    </div>
                    <span class="problem-time">{formatTime(problem.timestamp)}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* OUTPUT Tab */}
          <Show when={activeTab() === 'output'}>
            <div class="output-container">
              <Show when={outputMessages().length === 0}>
                <div class="output-empty">No output</div>
              </Show>
              <For each={outputMessages()}>
                {(msg) => (
                  <div class="output-line">
                    <span class="output-time">[{formatTime(msg.timestamp)}]</span>
                    <span class="output-channel">[{msg.channel}]</span>
                    <span class="output-message">{msg.message}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
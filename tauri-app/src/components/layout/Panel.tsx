import { Component, For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { appStore } from '../../stores';

export type PanelTab = 'terminal' | 'problems' | 'output';

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

// Terminal state
const [terminalLogs, setTerminalLogs] = createSignal<LogEntry[]>([
  { id: 1, time: new Date(Date.now() - 300000), message: '$ tauri dev', type: 'command' },
  { id: 2, time: new Date(Date.now() - 299000), message: '   Compiling financial-pipeline v0.2.0', type: 'output' },
  { id: 3, time: new Date(Date.now() - 250000), message: '    Finished dev [unoptimized + debuginfo] target(s) in 12.34s', type: 'output' },
  { id: 4, time: new Date(Date.now() - 200000), message: '        Info Watching for changes...', type: 'output' },
  { id: 5, time: new Date(Date.now() - 150000), message: '[API] Connected to market data feed', type: 'output' },
  { id: 6, time: new Date(Date.now() - 100000), message: '[API] Fetched prices for 156 symbols', type: 'output' },
  { id: 7, time: new Date(Date.now() - 50000), message: '[AI] Model loaded: gpt-4-turbo', type: 'output' },
  { id: 8, time: new Date(Date.now() - 30000), message: '[WARN] API rate limit: 23/25 calls used', type: 'error' },
  { id: 9, time: new Date(Date.now() - 10000), message: '[AI] Analyzing 24 positions...', type: 'output' },
]);

// Problems state
const [problems, setProblems] = createSignal<Problem[]>([
  { id: 1, severity: 'error', message: 'Failed to fetch FRED data: Connection timeout', source: 'API Gateway', timestamp: new Date(Date.now() - 432000) },
  { id: 2, severity: 'warning', message: 'API rate limit approaching (92%)', source: 'Rate Limiter', timestamp: new Date(Date.now() - 93000) },
  { id: 3, severity: 'warning', message: 'Stale price data for 3 symbols (>5min old)', source: 'Data Validator', timestamp: new Date(Date.now() - 60000) },
  { id: 4, severity: 'info', message: 'Market closes in 2 hours', source: 'Scheduler', timestamp: new Date(Date.now() - 30000) },
]);

// Output state
const [outputMessages, setOutputMessages] = createSignal<OutputMessage[]>([
  { id: 1, channel: 'Market Data', message: 'WebSocket connected to wss://stream.data.alpaca.markets', timestamp: new Date(Date.now() - 300000) },
  { id: 2, channel: 'Market Data', message: 'Subscribed to 156 symbols', timestamp: new Date(Date.now() - 295000) },
  { id: 3, channel: 'AI Trader', message: 'Initialized with strategy: momentum_reversal_v2', timestamp: new Date(Date.now() - 200000) },
  { id: 4, channel: 'AI Trader', message: 'Portfolio analysis complete: 24 positions evaluated', timestamp: new Date(Date.now() - 150000) },
  { id: 5, channel: 'Alerts', message: 'Price alert triggered: NVDA crossed $870', timestamp: new Date(Date.now() - 50000) },
  { id: 6, channel: 'System', message: 'Auto-save completed', timestamp: new Date(Date.now() - 10000) },
]);

const [activeTab, setActiveTab] = createSignal<PanelTab>('terminal');
const [terminalInput, setTerminalInput] = createSignal('');
let terminalRef: HTMLDivElement | undefined;
let inputRef: HTMLInputElement | undefined;

const tabs: { id: PanelTab; label: string; badge?: () => number }[] = [
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'problems', label: 'PROBLEMS', badge: () => problems().filter(p => p.severity === 'error').length },
  { id: 'output', label: 'OUTPUT' },
];

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const handleTerminalSubmit = (e: Event) => {
  e.preventDefault();
  const cmd = terminalInput().trim();
  if (!cmd) return;
  
  const newId = terminalLogs().length + 1;
  setTerminalLogs([...terminalLogs(), { id: newId, time: new Date(), message: `$ ${cmd}`, type: 'command' }]);
  
  // Simulate command response
  setTimeout(() => {
    let response = '';
    if (cmd === 'help') {
      response = 'Available commands: help, clear, status, refresh, positions';
    } else if (cmd === 'clear') {
      setTerminalLogs([]);
      return;
    } else if (cmd === 'status') {
      response = 'System Status: OK | API: Connected | Positions: 24 | P&L: +$9,132.30';
    } else if (cmd === 'refresh') {
      response = 'Refreshing market data...';
    } else if (cmd === 'positions') {
      response = 'NVDA: +$6,264 | AAPL: +$2,744 | META: +$1,409 | MSFT: -$337 | TSLA: -$947';
    } else {
      response = `Command not found: ${cmd}. Type 'help' for available commands.`;
    }
    setTerminalLogs([...terminalLogs(), { id: newId + 1, time: new Date(), message: response, type: 'output' }]);
  }, 100);
  
  setTerminalInput('');
};

const clearProblems = () => {
  setProblems([]);
};

const clearOutput = () => {
  setOutputMessages([]);
};

// Scroll terminal to bottom when new logs added
const scrollTerminalToBottom = () => {
  if (terminalRef) {
    terminalRef.scrollTop = terminalRef.scrollHeight;
  }
};

export const Panel: Component = () => {
  // Focus terminal input when terminal tab is active
  const focusTerminal = () => {
    if (activeTab() === 'terminal' && inputRef) {
      inputRef.focus();
    }
  };

  // Expose focus function globally for keyboard shortcut
  onMount(() => {
    (window as any).__focusTerminal = focusTerminal;
  });

  onCleanup(() => {
    delete (window as any).__focusTerminal;
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
            <Show when={activeTab() === 'terminal'}>
              <button class="btn btn-icon btn-ghost" title="Clear Terminal" onClick={() => setTerminalLogs([])}>
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
          <Show when={activeTab() === 'terminal'}>
            <div class="terminal-container">
              <div class="terminal-output" ref={terminalRef} onClick={focusTerminal}>
                <For each={terminalLogs()}>
                  {(entry) => (
                    <div class={`terminal-line ${entry.type || ''}`}>
                      <span class="terminal-time">[{formatTime(entry.time)}]</span>
                      <span class="terminal-message">{entry.message}</span>
                    </div>
                  )}
                </For>
              </div>
              <form class="terminal-input-row" onSubmit={handleTerminalSubmit}>
                <span class="terminal-prompt">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  class="terminal-input"
                  value={terminalInput()}
                  onInput={(e) => setTerminalInput(e.currentTarget.value)}
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
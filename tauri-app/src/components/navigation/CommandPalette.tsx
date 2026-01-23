import { Component, For, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { appStore, ViewType } from '../../stores';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: string;
  action: () => void;
}

const icons: Record<string, string> = {
  search: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  chart: `<polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  portfolio: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>`,
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  ai: `<path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M6 10v2a6 6 0 0 0 12 0v-2"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51"/>`,
  refresh: `<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>`,
};

const commands: Command[] = [
  { id: 'search', label: 'Search Symbol...', shortcut: 'Ctrl+K', icon: 'search', action: () => {} },
  { id: 'chart', label: 'Open Chart', shortcut: 'Ctrl+G', icon: 'chart', action: () => appStore.setView('charts') },
  { id: 'fetch', label: 'Fetch Prices', shortcut: 'Ctrl+F', icon: 'download', action: () => {} },
  { id: 'portfolio', label: 'View Portfolio', shortcut: 'Ctrl+P', icon: 'portfolio', action: () => appStore.setView('portfolio') },
  { id: 'alert', label: 'Create Alert', shortcut: 'Ctrl+A', icon: 'bell', action: () => appStore.setView('alerts') },
  { id: 'ai', label: 'Start AI Trader Session', shortcut: 'Ctrl+T', icon: 'ai', action: () => appStore.setView('ai-trader') },
  { id: 'settings', label: 'Open Settings', shortcut: 'Ctrl+,', icon: 'settings', action: () => appStore.setView('settings') },
  { id: 'refresh', label: 'Refresh Data', shortcut: 'F5', icon: 'refresh', action: () => {} },
];

export const CommandPalette: Component = () => {
  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const filteredCommands = () => {
    const q = query().toLowerCase();
    if (!q) return commands;
    return commands.filter(cmd => cmd.label.toLowerCase().includes(q));
  };

  const executeCommand = (cmd: Command) => {
    cmd.action();
    appStore.closeCommandPalette();
    setQuery('');
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!appStore.state.commandPaletteOpen) {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        appStore.openCommandPalette();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        appStore.closeCommandPalette();
        setQuery('');
        setSelectedIndex(0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands().length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        const cmd = filteredCommands()[selectedIndex()];
        if (cmd) executeCommand(cmd);
        break;
    }
  };

  createEffect(() => {
    if (appStore.state.commandPaletteOpen && inputRef) {
      inputRef.focus();
    }
  });

  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('command-palette-overlay')) {
      appStore.closeCommandPalette();
      setQuery('');
      setSelectedIndex(0);
    }
  };

  return (
    <Show when={appStore.state.commandPaletteOpen}>
      <div class="command-palette-overlay" onClick={handleOverlayClick}>
        <div class="command-palette">
          <input
            ref={inputRef}
            type="text"
            class="command-palette-input"
            placeholder="Type a command or search..."
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setSelectedIndex(0);
            }}
          />
          <div class="command-palette-results">
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <div
                  class={`command-item ${index() === selectedIndex() ? 'selected' : ''}`}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(index())}
                >
                  <svg 
                    class="command-icon" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="2"
                    innerHTML={icons[cmd.icon]}
                  />
                  <span class="command-label">{cmd.label}</span>
                  <Show when={cmd.shortcut}>
                    <span class="command-shortcut">
                      <For each={cmd.shortcut!.split('+')}>
                        {(key) => <kbd>{key}</kbd>}
                      </For>
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
};
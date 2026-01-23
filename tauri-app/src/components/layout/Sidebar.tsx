import { Component, For, Show, createSignal } from 'solid-js';
import { symbolStore } from '../../stores';
import { formatPercent } from '../../utils';

interface SectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: any;
}

const Section: Component<SectionProps> = (props) => {
  const [open, setOpen] = createSignal(props.defaultOpen ?? true);

  return (
    <div class="section">
      <div 
        class={`section-header ${!open() ? 'collapsed' : ''}`}
        onClick={() => setOpen(!open())}
      >
        <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span class="section-title">{props.title}</span>
        <Show when={props.count !== undefined}>
          <span class="section-count">{props.count}</span>
        </Show>
      </div>
      <Show when={open()}>
        <div class="section-content">
          {props.children}
        </div>
      </Show>
    </div>
  );
};

export const Sidebar: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');

  const filteredSymbols = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return symbolStore.state.symbols.slice(0, 20);
    return symbolStore.state.symbols.filter(s => 
      s.symbol.toLowerCase().includes(query)
    ).slice(0, 50);
  };

  const handleSymbolClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Explorer</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button class="btn btn-icon btn-ghost" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          <button class="btn btn-icon btn-ghost" title="Collapse All">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 15h6"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
        <input
          type="text"
          class="input search-input"
          placeholder="Search symbols..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
      </div>

      <div class="sidebar-content">
        <Section title="Favorites" count={symbolStore.state.favorites.length}>
          <For each={symbolStore.getFavoriteSymbols()}>
            {(item) => (
              <div 
                class={`tree-item ${symbolStore.state.selectedSymbol === item.symbol ? 'selected' : ''}`}
                onClick={() => handleSymbolClick(item.symbol)}
              >
                <svg class="tree-icon" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                </svg>
                <span class="tree-label mono">{item.symbol}</span>
                <span class={`tree-value ${item.changeDirection}`}>
                  {formatPercent(item.changePercent)}
                </span>
              </div>
            )}
          </For>
          <Show when={symbolStore.state.favorites.length === 0}>
            <div style={{ padding: 'var(--space-2) var(--space-6)', color: 'var(--text-tertiary)', 'font-size': 'var(--text-sm)' }}>
              No favorites
            </div>
          </Show>
        </Section>

        <Section title="Watchlists" count={symbolStore.state.watchlists.length}>
          <For each={symbolStore.state.watchlists}>
            {(list) => (
              <div class="tree-item">
                <svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="tree-label">{list.name}</span>
                <span class="tree-value">{list.symbols.length}</span>
              </div>
            )}
          </For>
          <Show when={symbolStore.state.watchlists.length === 0}>
            <div style={{ padding: 'var(--space-2) var(--space-6)', color: 'var(--text-tertiary)', 'font-size': 'var(--text-sm)' }}>
              No watchlists
            </div>
          </Show>
        </Section>

        <Section title="Symbols" count={filteredSymbols().length}>
          <For each={filteredSymbols()}>
            {(item) => (
              <div 
                class={`tree-item ${symbolStore.state.selectedSymbol === item.symbol ? 'selected' : ''}`}
                onClick={() => handleSymbolClick(item.symbol)}
              >
                <svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/>
                </svg>
                <span class="tree-label mono">{item.symbol}</span>
                <span class={`tree-value ${item.changeDirection}`}>
                  {formatPercent(item.changePercent)}
                </span>
              </div>
            )}
          </For>
        </Section>
      </div>
    </aside>
  );
};
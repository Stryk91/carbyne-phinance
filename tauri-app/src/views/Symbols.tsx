import { Component, For, Show, createSignal, createResource } from 'solid-js';
import { formatCurrency, formatPercent } from '../utils';
import { symbolStore } from '../stores';
import {
  getSymbols,
  toggleFavorite,
  getAllWatchlists,
  getWatchlistDetail,
  createWatchlist,
  deleteWatchlist,
  removeSymbolFromWatchlist,
  addSymbolToWatchlist,
} from '../api';

// Predefined stock categories for auto-populate
// These should match symbols that exist in your database
const STOCK_CATEGORIES: Record<string, string[]> = {
  'Tech Giants': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'ORCL', 'PLTR'],
  'Space & Defense': ['RKLB', 'LUNR', 'KTOS', 'OKLO', 'AEHR'],
  'Finance': ['JPM', 'BLK', 'BRK.B'],
  'Crypto': ['BTC-USD', 'BNB-USD'],
  'ETFs & Commodities': ['GLD', 'TLT'],
  'Cannabis': ['ACB'],
  'EV': ['TSLA'],
};

export const Symbols: Component = () => {
  const [activeWatchlist, setActiveWatchlist] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [newWatchlistName, setNewWatchlistName] = createSignal('');
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk selection state
  const [selectedSymbols, setSelectedSymbols] = createSignal<Set<string>>(new Set());
  const [showBulkAddDropdown, setShowBulkAddDropdown] = createSignal(false);
  const [showAutoPopulateDropdown, setShowAutoPopulateDropdown] = createSignal(false);

  // Fetch all symbols
  const [symbolsData, { refetch: refetchSymbols }] = createResource(getSymbols);

  // Fetch watchlists
  const [watchlistsData, { refetch: refetchWatchlists }] = createResource(getAllWatchlists);

  // Fetch active watchlist details
  const [watchlistDetail, { refetch: refetchDetail }] = createResource(
    () => activeWatchlist(),
    async (name) => name ? getWatchlistDetail(name) : null
  );

  // Filtered symbols
  const filteredSymbols = () => {
    const symbols = symbolsData() || [];
    const query = searchQuery().toLowerCase();
    if (!query) return symbols;
    return symbols.filter(s => s.symbol.toLowerCase().includes(query));
  };

  // Watchlist symbols
  const watchlistSymbols = () => {
    const detail = watchlistDetail();
    if (!detail) return [];
    const allSymbols = symbolsData() || [];
    return allSymbols.filter(s => detail.symbols.includes(s.symbol));
  };

  const handleToggleFavorite = async (symbol: string) => {
    try {
      await toggleFavorite(symbol);
      refetchSymbols();
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  const handleCreateWatchlist = async () => {
    const name = newWatchlistName().trim();
    if (!name) return;

    try {
      const result = await createWatchlist(name, [], null);
      if (result.success) {
        setMessage({ type: 'success', text: `Watchlist "${name}" created` });
        setNewWatchlistName('');
        setShowCreateForm(false);
        refetchWatchlists();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteWatchlist = async (name: string) => {
    try {
      const result = await deleteWatchlist(name);
      if (result.success) {
        if (activeWatchlist() === name) {
          setActiveWatchlist(null);
        }
        refetchWatchlists();
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
  };

  const handleRemoveFromWatchlist = async (symbol: string) => {
    const watchlist = activeWatchlist();
    if (!watchlist) return;

    try {
      await removeSymbolFromWatchlist(watchlist, symbol);
      refetchDetail();
    } catch (e) {
      console.error('Failed to remove from watchlist:', e);
    }
  };

  // Toggle symbol selection for bulk operations
  const toggleSymbolSelection = (symbol: string) => {
    const current = selectedSymbols();
    const newSet = new Set(current);
    if (newSet.has(symbol)) {
      newSet.delete(symbol);
    } else {
      newSet.add(symbol);
    }
    setSelectedSymbols(newSet);
  };

  // Select/deselect all visible symbols
  const toggleSelectAll = () => {
    const visible = activeWatchlist() ? watchlistSymbols() : filteredSymbols();
    const current = selectedSymbols();
    const allSelected = visible.every(s => current.has(s.symbol));

    if (allSelected) {
      setSelectedSymbols(new Set<string>());
    } else {
      setSelectedSymbols(new Set<string>(visible.map(s => s.symbol)));
    }
  };

  // Bulk add selected symbols to a watchlist
  const handleBulkAddToWatchlist = async (watchlistName: string) => {
    const symbols = Array.from(selectedSymbols());
    if (symbols.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const symbol of symbols) {
      try {
        const result = await addSymbolToWatchlist(watchlistName, symbol);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setMessage({
      type: successCount > 0 ? 'success' : 'error',
      text: `Added ${successCount} symbol(s) to "${watchlistName}"${errorCount > 0 ? `, ${errorCount} failed` : ''}`
    });
    setSelectedSymbols(new Set<string>());
    setShowBulkAddDropdown(false);
    refetchWatchlists();
    setTimeout(() => setMessage(null), 3000);
  };

  // Auto-populate a category watchlist
  const handleAutoPopulate = async (category: string) => {
    const categorySymbols = STOCK_CATEGORIES[category];
    if (!categorySymbols) return;

    // Create watchlist if it doesn't exist
    const existingWatchlists = watchlistsData() || [];
    const exists = existingWatchlists.some(w => w.name === category);

    if (!exists) {
      try {
        await createWatchlist(category, [], `Auto-populated ${category} stocks`);
      } catch {
        setMessage({ type: 'error', text: `Failed to create watchlist "${category}"` });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    }

    // Get available symbols from our data
    const availableSymbols = symbolsData() || [];
    const availableSymbolSet = new Set(availableSymbols.map(s => s.symbol));

    // Add symbols that exist in our data
    let successCount = 0;
    let skippedCount = 0;

    for (const symbol of categorySymbols) {
      if (availableSymbolSet.has(symbol)) {
        try {
          const result = await addSymbolToWatchlist(category, symbol);
          if (result.success) successCount++;
        } catch {
          // Symbol might already be in watchlist, continue
        }
      } else {
        skippedCount++;
      }
    }

    setMessage({
      type: 'success',
      text: `Added ${successCount} ${category} stocks${skippedCount > 0 ? ` (${skippedCount} not in your symbols)` : ''}`
    });
    setShowAutoPopulateDropdown(false);
    refetchWatchlists();
    setTimeout(() => setMessage(null), 3000);
  };

  // Add single symbol to watchlist (for dropdown)
  const handleAddToWatchlist = async (watchlistName: string, symbol: string) => {
    try {
      const result = await addSymbolToWatchlist(watchlistName, symbol);
      if (result.success) {
        setMessage({ type: 'success', text: `Added ${symbol} to "${watchlistName}"` });
        refetchWatchlists();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div class="editor-content">
      <div class="symbols-container">
        {/* Header */}
        <div class="symbols-header">
          <h2>Symbols & Watchlists</h2>
          <div class="symbols-actions">
            {/* Auto-populate dropdown */}
            <div class="dropdown-container">
              <button
                class="btn btn-secondary btn-sm"
                onClick={() => setShowAutoPopulateDropdown(!showAutoPopulateDropdown())}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/>
                </svg>
                Auto-Populate Groups
              </button>
              <Show when={showAutoPopulateDropdown()}>
                <div class="dropdown-menu">
                  <For each={Object.keys(STOCK_CATEGORIES)}>
                    {(category) => (
                      <button
                        class="dropdown-item"
                        onClick={() => handleAutoPopulate(category)}
                      >
                        {category} ({STOCK_CATEGORIES[category].length} stocks)
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Bulk add dropdown - only show when symbols are selected */}
            <Show when={selectedSymbols().size > 0}>
              <div class="dropdown-container">
                <button
                  class="btn btn-primary btn-sm"
                  onClick={() => setShowBulkAddDropdown(!showBulkAddDropdown())}
                >
                  Add {selectedSymbols().size} to Watchlist
                </button>
                <Show when={showBulkAddDropdown()}>
                  <div class="dropdown-menu">
                    <For each={watchlistsData() || []} fallback={
                      <div class="dropdown-item disabled">No watchlists - create one first</div>
                    }>
                      {(wl) => (
                        <button
                          class="dropdown-item"
                          onClick={() => handleBulkAddToWatchlist(wl.name)}
                        >
                          {wl.name}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            <div class="symbols-search">
              <input
                type="text"
                class="input search-input"
                placeholder="Search symbols..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <Show when={message()}>
          <div class={`alert-message ${message()!.type}`}>
            {message()!.text}
          </div>
        </Show>

        <div class="symbols-layout">
          {/* Watchlists Sidebar */}
          <div class="watchlists-panel">
            <div class="panel-header">
              <span>Watchlists</span>
              <button
                class="btn btn-icon btn-ghost"
                onClick={() => setShowCreateForm(!showCreateForm())}
                title="Create Watchlist"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            <Show when={showCreateForm()}>
              <div class="create-watchlist-form">
                <input
                  type="text"
                  class="input"
                  placeholder="Watchlist name"
                  value={newWatchlistName()}
                  onInput={(e) => setNewWatchlistName(e.currentTarget.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateWatchlist()}
                />
                <button class="btn btn-primary btn-sm" onClick={handleCreateWatchlist}>
                  Create
                </button>
              </div>
            </Show>

            <div class="watchlist-items">
              <button
                class={`watchlist-item ${activeWatchlist() === null ? 'active' : ''}`}
                onClick={() => setActiveWatchlist(null)}
              >
                <span>All Symbols</span>
                <span class="watchlist-count">{(symbolsData() || []).length}</span>
              </button>
              <For each={watchlistsData() || []}>
                {(wl) => (
                  <div class={`watchlist-item ${activeWatchlist() === wl.name ? 'active' : ''}`}>
                    <button
                      class="watchlist-name"
                      onClick={() => setActiveWatchlist(wl.name)}
                    >
                      <span>{wl.name}</span>
                      <span class="watchlist-count">{wl.symbol_count}</span>
                    </button>
                    <button
                      class="btn btn-icon btn-ghost btn-sm"
                      onClick={() => handleDeleteWatchlist(wl.name)}
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Symbols Table */}
          <div class="symbols-table-panel">
            <div class="card">
              <div class="card-header">
                <span class="card-title">
                  {activeWatchlist() ? activeWatchlist() : 'All Symbols'}
                </span>
              </div>
              <div style={{ "max-height": "600px", "overflow-y": "auto" }}>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}>
                        <input
                          type="checkbox"
                          checked={(() => {
                            const visible = activeWatchlist() ? watchlistSymbols() : filteredSymbols();
                            return visible.length > 0 && visible.every(s => selectedSymbols().has(s.symbol));
                          })()}
                          onChange={toggleSelectAll}
                          title="Select all"
                        />
                      </th>
                      <th></th>
                      <th>Symbol</th>
                      <th>Price</th>
                      <th>Change</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={activeWatchlist() ? watchlistSymbols() : filteredSymbols()} fallback={
                      <tr>
                        <td colspan="6" class="text-center text-muted">No symbols found</td>
                      </tr>
                    }>
                      {(sym) => {
                        const [showWatchlistDropdown, setShowWatchlistDropdown] = createSignal(false);
                        return (
                          <tr
                            class={`clickable-row ${symbolStore.state.selectedSymbol === sym.symbol ? 'selected' : ''} ${selectedSymbols().has(sym.symbol) ? 'bulk-selected' : ''}`}
                            onClick={() => handleSelectSymbol(sym.symbol)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedSymbols().has(sym.symbol)}
                                onChange={() => toggleSymbolSelection(sym.symbol)}
                              />
                            </td>
                            <td>
                              <button
                                class={`btn btn-icon btn-ghost favorite-btn ${sym.favorited ? 'favorited' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(sym.symbol); }}
                                title={sym.favorited ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={sym.favorited ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                              </button>
                            </td>
                            <td class="mono" style={{ "font-weight": "600" }}>{sym.symbol}</td>
                            <td class="mono">{formatCurrency(sym.price)}</td>
                            <td class={`mono ${sym.change_direction === 'up' ? 'text-up' : sym.change_direction === 'down' ? 'text-down' : ''}`}>
                              {formatPercent(sym.change_percent)}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <Show when={activeWatchlist()}>
                                <button
                                  class="btn btn-icon btn-ghost btn-sm"
                                  onClick={() => handleRemoveFromWatchlist(sym.symbol)}
                                  title="Remove from watchlist"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                  </svg>
                                </button>
                              </Show>
                              <Show when={!activeWatchlist() && watchlistsData()?.length}>
                                <div class="dropdown-container inline">
                                  <button
                                    class="btn btn-icon btn-ghost btn-sm"
                                    onClick={() => setShowWatchlistDropdown(!showWatchlistDropdown())}
                                    title="Add to watchlist"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                  </button>
                                  <Show when={showWatchlistDropdown()}>
                                    <div class="dropdown-menu right">
                                      <For each={watchlistsData() || []}>
                                        {(wl) => (
                                          <button
                                            class="dropdown-item"
                                            onClick={() => {
                                              handleAddToWatchlist(wl.name, sym.symbol);
                                              setShowWatchlistDropdown(false);
                                            }}
                                          >
                                            {wl.name}
                                          </button>
                                        )}
                                      </For>
                                    </div>
                                  </Show>
                                </div>
                              </Show>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

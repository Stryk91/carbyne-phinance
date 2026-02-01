import { Component, Show, createSignal } from 'solid-js';
import { newsStore, symbolStore } from '../stores';
import { toggleFavorite, addSymbolToWatchlist, getAllWatchlists, type WatchlistSummary } from '../api';

export const NewsDetail: Component = () => {
  const [showWatchlistDropdown, setShowWatchlistDropdown] = createSignal(false);
  const [watchlists, setWatchlists] = createSignal<WatchlistSummary[]>([]);
  const [message, setMessage] = createSignal<string | null>(null);

  const news = () => newsStore.state.selectedNews;

  const handleClose = () => {
    newsStore.closeDetail();
  };

  const handleOpenUrl = () => {
    const url = news()?.url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleAddToFavorites = async () => {
    const symbol = news()?.symbol;
    if (!symbol) return;

    try {
      await toggleFavorite(symbol);
      setMessage(`Added ${symbol} to favorites`);
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
  };

  const handleSelectSymbol = () => {
    const symbol = news()?.symbol;
    if (symbol) {
      symbolStore.selectSymbol(symbol);
    }
  };

  const handleShowWatchlists = async () => {
    try {
      const lists = await getAllWatchlists();
      setWatchlists(lists);
      setShowWatchlistDropdown(true);
    } catch (e) {
      setMessage(`Error loading watchlists: ${e}`);
    }
  };

  const handleAddToWatchlist = async (watchlistName: string) => {
    const symbol = news()?.symbol;
    if (!symbol) return;

    try {
      await addSymbolToWatchlist(watchlistName, symbol);
      setMessage(`Added ${symbol} to ${watchlistName}`);
      setShowWatchlistDropdown(false);
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Show when={newsStore.state.showDetail && news()}>
      <div class="news-detail-overlay" onClick={handleClose}>
        <div class="news-detail-panel" onClick={(e) => e.stopPropagation()}>
          <div class="news-detail-header">
            <div class="news-detail-meta">
              <span class="news-detail-source">{news()!.source}</span>
              <span class="news-detail-date">{formatDate(news()!.date)}</span>
            </div>
            <button class="btn btn-icon btn-ghost" onClick={handleClose} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <h2 class="news-detail-headline">{news()!.headline}</h2>

          <Show when={news()!.symbol}>
            <div class="news-detail-symbol" onClick={handleSelectSymbol}>
              <span class="symbol-tag">${news()!.symbol}</span>
              <span class="symbol-hint">Click to view chart</span>
            </div>
          </Show>

          <p class="news-detail-summary">{news()!.summary || 'No summary available.'}</p>

          <Show when={message()}>
            <div class="news-detail-message">{message()}</div>
          </Show>

          <div class="news-detail-actions">
            <button class="btn btn-primary" onClick={handleOpenUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Read Full Article
            </button>

            <Show when={news()!.symbol}>
              <button class="btn btn-secondary" onClick={handleAddToFavorites} title="Add to Favorites">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Favorite
              </button>

              <div class="dropdown-container">
                <button class="btn btn-secondary" onClick={handleShowWatchlists} title="Add to Watchlist">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Watchlist
                </button>
                <Show when={showWatchlistDropdown()}>
                  <div class="dropdown-menu">
                    <Show when={watchlists().length === 0}>
                      <div class="dropdown-item disabled">No watchlists found</div>
                    </Show>
                    {watchlists().map(wl => (
                      <button class="dropdown-item" onClick={() => handleAddToWatchlist(wl.name)}>
                        {wl.name}
                      </button>
                    ))}
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

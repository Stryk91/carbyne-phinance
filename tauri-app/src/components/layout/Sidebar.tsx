import { Component, For, Show, createSignal, createResource, createMemo, onMount, onCleanup } from 'solid-js';
import { symbolStore, settingsStore, SymbolData, newsStore } from '../../stores';
import { formatCurrency, formatPercent } from '../../utils';
import {
  getSymbols,
  getPaperPositions,
  getDcPositions,
  fetchNews,
  savePrediction,
  type SymbolPrice,
  type PaperPosition,
  type DcPosition,
  type SimpleNewsItem,
  type SavePredictionParams
} from '../../api';
import { addLog, addOutput } from './Panel';

interface SectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  headerAction?: any;
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
        <Show when={props.headerAction}>
          <div class="section-action" onClick={(e) => e.stopPropagation()}>
            {props.headerAction}
          </div>
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

// Mini sparkline component
const Sparkline: Component<{ data: number[]; width?: number; height?: number; color?: string }> = (props) => {
  const width = props.width || 50;
  const height = props.height || 20;
  const color = props.color || 'var(--price-up)';
  
  const points = () => {
    const data = props.data;
    if (data.length < 2) return '';
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <svg width={width} height={height} class="sparkline">
      <polyline
        points={points()}
        fill="none"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

// Sentiment badge component
const SentimentBadge: Component<{ sentiment: 'bullish' | 'bearish' | 'neutral' }> = (props) => {
  const colors = {
    bullish: { bg: 'var(--color-success-muted)', text: 'var(--color-success)' },
    bearish: { bg: 'var(--color-error-muted)', text: 'var(--color-error)' },
    neutral: { bg: 'var(--bg-overlay)', text: 'var(--text-secondary)' },
  };
  
  return (
    <span 
      class="sentiment-badge"
      style={{
        background: colors[props.sentiment].bg,
        color: colors[props.sentiment].text,
      }}
    >
      {props.sentiment}
    </span>
  );
};

// Watchlist item with sparkline data
interface WatchlistItem extends SymbolData {
  sparklineData: number[];
}

// Cache for sparkline data - prevents regeneration on re-render
const sparklineCache = new Map<string, number[]>();

// Simple seeded random number generator (consistent per symbol)
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Hash string to number for seeding
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Generate sparkline from price - uses seeded random for consistency
const generateSparklineData = (symbol: string, basePrice: number, trend: 'up' | 'down' | 'flat'): number[] => {
  // Check cache first
  const cacheKey = `${symbol}-${basePrice.toFixed(2)}-${trend}`;
  if (sparklineCache.has(cacheKey)) {
    return sparklineCache.get(cacheKey)!;
  }

  const data: number[] = [];
  let price = basePrice * 0.95;
  const baseSeed = hashString(symbol);

  for (let i = 0; i < 20; i++) {
    const trendFactor = trend === 'up' ? 0.003 : trend === 'down' ? -0.003 : 0;
    const randomFactor = (seededRandom(baseSeed + i) - 0.5) * 0.02;
    price = price * (1 + trendFactor + randomFactor);
    data.push(price);
  }

  // Cache the result
  sparklineCache.set(cacheKey, data);
  return data;
};

// Convert API SymbolPrice to WatchlistItem
const symbolToWatchlistItem = (s: SymbolPrice): WatchlistItem => ({
  symbol: s.symbol,
  price: s.price,
  changePercent: s.change_percent,
  changeDirection: s.change_direction === 'up' ? 'up' : s.change_direction === 'down' ? 'down' : 'unchanged',
  favorited: s.favorited,
  sparklineData: generateSparklineData(s.symbol, s.price, s.change_direction === 'up' ? 'up' : s.change_direction === 'down' ? 'down' : 'flat'),
});

// News types - we'll keep these but populate from API later
interface NewsItem {
  id: number;
  finnhub_id: number;  // For prediction tracking
  headline: string;
  source: string;
  time: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  symbols: string[];
  // Original data for detail view
  url?: string;
  summary?: string;
  date?: string;
}

// Placeholder news until fetchNews is called
const placeholderNews: NewsItem[] = [
  { id: 1, finnhub_id: 0, headline: 'Loading news...', source: '-', time: '-', sentiment: 'neutral', symbols: [] },
];

// Position display interface
interface PositionDisplay {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  side: 'long' | 'short';
}

// Convert API PaperPosition to PositionDisplay
const paperPositionToDisplay = (p: PaperPosition): PositionDisplay => ({
  symbol: p.symbol,
  shares: p.quantity,
  avgCost: p.entry_price,
  currentPrice: p.current_price,
  pnl: p.unrealized_pnl,
  pnlPercent: p.unrealized_pnl_percent,
  side: 'long',
});

// Convert API DcPosition to PositionDisplay
const dcPositionToDisplay = (p: DcPosition): PositionDisplay => ({
  symbol: p.symbol,
  shares: p.quantity,
  avgCost: p.entry_price,
  currentPrice: p.current_price,
  pnl: p.unrealized_pnl,
  pnlPercent: p.unrealized_pnl_percent,
  side: 'long',
});

// Derive sentiment from headline keywords
const deriveSentiment = (headline: string): 'bullish' | 'bearish' | 'neutral' => {
  const h = headline.toLowerCase();
  const bullish = /\b(surge|rally|soar|jump|gain|rise|beat|upgrade|bull|boom|record high|breakout|outperform|strong|growth)\b/;
  const bearish = /\b(crash|drop|fall|plunge|sink|miss|downgrade|bear|bust|record low|breakdown|underperform|weak|decline|loss|sell.?off|tumble)\b/;
  if (bullish.test(h)) return 'bullish';
  if (bearish.test(h)) return 'bearish';
  return 'neutral';
};

// Convert API SimpleNewsItem to NewsItem
const apiNewsToNewsItem = (n: SimpleNewsItem, idx: number): NewsItem => ({
  id: idx,
  finnhub_id: idx + Date.now(),
  headline: n.headline,
  source: n.source,
  time: formatTimeAgo(n.date),
  sentiment: deriveSentiment(n.headline),
  symbols: n.symbol ? [n.symbol] : [],
  url: n.url,
  summary: n.summary,
  date: n.date,
});

// Format date to "2m", "1h", etc.
const formatTimeAgo = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  } catch {
    return '-';
  }
};

export const Sidebar: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');

  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; news: NewsItem } | null>(null);
  const [showPredictionModal, setShowPredictionModal] = createSignal(false);
  const [selectedNewsForPrediction, setSelectedNewsForPrediction] = createSignal<NewsItem | null>(null);

  // Prediction form state
  const [predictionDirection, setPredictionDirection] = createSignal<'bullish' | 'bearish' | 'neutral'>('neutral');
  const [predictionSummary, setPredictionSummary] = createSignal('');
  const [predictionTimeframe, setPredictionTimeframe] = createSignal(14);

  // === REAL DATA FETCHING ===

  // Fetch symbols for watchlist
  const [symbolsData, { refetch: refetchSymbols }] = createResource(getSymbols);

  // Fetch positions based on active team
  const fetchPositions = async () => {
    if (settingsStore.state.activeTeam === 'DC') {
      return getDcPositions();
    }
    return getPaperPositions();
  };

  // Refetch when team changes
  const [positionsData, { refetch: refetchPositions }] = createResource(
    () => settingsStore.state.activeTeam,
    fetchPositions
  );

  // Fetch news if we have an API key and a selected symbol
  const fetchNewsData = async () => {
    const apiKey = settingsStore.state.finnhubApiKey;
    const symbol = symbolStore.state.selectedSymbol;
    if (!apiKey || !symbol) return null;
    try {
      const response = await fetchNews(symbol, apiKey, 5);
      return response.news;
    } catch {
      return null;
    }
  };

  const [newsData, { refetch: refetchNews }] = createResource(
    () => ({ key: settingsStore.state.finnhubApiKey, symbol: symbolStore.state.selectedSymbol }),
    fetchNewsData
  );

  // Refresh all sidebar data
  const handleRefresh = () => {
    refetchSymbols();
    refetchPositions();
    refetchNews();
  };

  // Convert API data to watchlist items
  const watchlist = createMemo(() => {
    const symbols = symbolsData() || [];
    return symbols.map(symbolToWatchlistItem);
  });

  // Convert API positions to display format (works for both Paper and DC)
  const positions = createMemo(() => {
    const pos = positionsData() || [];
    if (settingsStore.state.activeTeam === 'DC') {
      return (pos as DcPosition[]).map(dcPositionToDisplay);
    }
    return (pos as PaperPosition[]).map(paperPositionToDisplay);
  });

  // Filter watchlist by search query
  const filteredWatchlist = () => {
    const query = searchQuery().toLowerCase();
    const items = watchlist();
    if (!query) return items;
    return items.filter(s => s.symbol.toLowerCase().includes(query));
  };

  const handleSymbolClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  const handleTeamToggle = () => {
    settingsStore.toggleTeam();
    refetchPositions();
  };

  const handleNewsClick = (newsItem: NewsItem) => {
    if (!newsItem.url) return; // Don't open placeholder items

    // Open article in default browser
    window.open(newsItem.url, '_blank');

    newsStore.selectNews({
      headline: newsItem.headline,
      summary: newsItem.summary || '',
      source: newsItem.source,
      url: newsItem.url || '',
      date: newsItem.date || '',
      symbol: newsItem.symbols[0] || '',
    });
  };

  // Context menu handlers
  const handleNewsContextMenu = (e: MouseEvent, newsItem: NewsItem) => {
    e.preventDefault();
    if (!newsItem.url) return; // Don't show for placeholder items
    setContextMenu({ x: e.clientX, y: e.clientY, news: newsItem });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const openPredictionModal = (newsItem: NewsItem) => {
    setSelectedNewsForPrediction(newsItem);
    setPredictionDirection('neutral');
    setPredictionSummary('');
    setPredictionTimeframe(14);
    setShowPredictionModal(true);
    closeContextMenu();
  };

  const handleSavePrediction = async () => {
    const newsItem = selectedNewsForPrediction();
    if (!newsItem) return;

    try {
      const params: SavePredictionParams = {
        finnhub_id: newsItem.finnhub_id,
        symbol: newsItem.symbols[0] || symbolStore.state.selectedSymbol || 'UNKNOWN',
        headline: newsItem.headline,
        prediction_summary: predictionSummary() || newsItem.headline,
        predicted_direction: predictionDirection(),
        source: newsItem.source,
        timeframe_days: predictionTimeframe(),
      };

      const result = await savePrediction(params);
      if (result.success) {
        addLog(`Prediction saved for ${params.symbol}: ${predictionDirection()}`, 'output');
        addOutput('Prediction', `Saved: ${newsItem.headline.substring(0, 50)}... (${predictionDirection()}, ${predictionTimeframe()} days)`);
      } else {
        addLog(`Failed to save prediction: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      addLog(`Error saving prediction: ${err}`, 'error');
    }

    setShowPredictionModal(false);
    setSelectedNewsForPrediction(null);
  };

  // Close context menu on click outside
  onMount(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    onCleanup(() => document.removeEventListener('click', handleClick));
  });

  const totalPnL = () => positions().reduce((sum, p) => sum + p.pnl, 0);

  // News from API or placeholder
  const news = (): NewsItem[] => {
    const apiNews = newsData();
    if (apiNews && apiNews.length > 0) {
      return apiNews.map(apiNewsToNewsItem);
    }
    if (!settingsStore.hasFinnhubKey()) {
      return [{ id: 0, finnhub_id: 0, headline: 'Add Finnhub API key in Settings to see news', source: '-', time: '-', sentiment: 'neutral', symbols: [] }];
    }
    if (!symbolStore.state.selectedSymbol) {
      return [{ id: 0, finnhub_id: 0, headline: 'Select a symbol to see news', source: '-', time: '-', sentiment: 'neutral', symbols: [] }];
    }
    return placeholderNews;
  };

  // Auto-refresh based on settings interval (0 = disabled)
  let refreshInterval: number | undefined;

  onMount(() => {
    const intervalSec = settingsStore.state.autoRefreshInterval;
    if (intervalSec > 0) {
      refreshInterval = window.setInterval(handleRefresh, intervalSec * 1000);
    }
  });

  onCleanup(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
    }
  });

  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Explorer</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button class="btn btn-icon btn-ghost" title="Refresh" onClick={handleRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          <button class="btn btn-icon btn-ghost" title="Collapse All" onClick={() => {
            document.querySelectorAll('.sidebar .section-header:not(.collapsed)').forEach(el => (el as HTMLElement).click());
          }}>
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
        {/* WATCHLIST Panel */}
        <Section title="WATCHLIST" count={filteredWatchlist().length} defaultOpen={true}>
          <For each={filteredWatchlist()}>
            {(item) => (
              <div 
                class={`watchlist-item ${symbolStore.state.selectedSymbol === item.symbol ? 'selected' : ''}`}
                onClick={() => handleSymbolClick(item.symbol)}
              >
                <div class="watchlist-info">
                  <span class="watchlist-symbol">{item.symbol}</span>
                  <span class="watchlist-price">{formatCurrency(item.price)}</span>
                </div>
                <div class="watchlist-chart">
                  <Sparkline 
                    data={item.sparklineData} 
                    color={item.changeDirection === 'up' ? 'var(--price-up)' : 'var(--price-down)'} 
                  />
                </div>
                <span class={`watchlist-change ${item.changeDirection}`}>
                  {formatPercent(item.changePercent)}
                </span>
              </div>
            )}
          </For>
        </Section>

        {/* NEWS Panel */}
        <Section title="NEWS" count={news().length} defaultOpen={true}>
          <For each={news()}>
            {(newsItem) => (
              <div
                class={`news-item ${newsItem.url ? 'clickable' : ''}`}
                onClick={() => handleNewsClick(newsItem)}
                onContextMenu={(e) => handleNewsContextMenu(e, newsItem)}
              >
                <div class="news-header">
                  <span class="news-source">{newsItem.source}</span>
                  <span class="news-time">{newsItem.time}</span>
                </div>
                <div class="news-headline">{newsItem.headline}</div>
                <div class="news-footer">
                  <SentimentBadge sentiment={newsItem.sentiment} />
                  <Show when={newsItem.symbols.length > 0}>
                    <div class="news-symbols">
                      <For each={newsItem.symbols}>
                        {(sym) => (
                          <span
                            class="news-symbol-tag"
                            onClick={(e) => { e.stopPropagation(); handleSymbolClick(sym); }}
                          >
                            ${sym}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </Section>

        {/* POSITIONS Panel */}
        <Section
          title="POSITIONS"
          count={positions().length}
          defaultOpen={true}
          headerAction={
            <button
              class={`team-toggle-btn ${settingsStore.state.activeTeam === 'KALIC' ? 'kalic' : 'dc'}`}
              onClick={handleTeamToggle}
              title={`Switch to ${settingsStore.state.activeTeam === 'KALIC' ? 'DC' : 'KALIC'}`}
            >
              {settingsStore.state.activeTeam}
            </button>
          }
        >
          <div class="positions-summary">
            <span class="positions-label">Total P&L</span>
            <span class={`positions-total ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '+' : ''}{formatCurrency(totalPnL())}
            </span>
          </div>
          <For each={positions()}>
            {(pos) => (
              <div 
                class={`position-item ${symbolStore.state.selectedSymbol === pos.symbol ? 'selected' : ''}`}
                onClick={() => handleSymbolClick(pos.symbol)}
              >
                <div class="position-main">
                  <div class="position-symbol-row">
                    <span class="position-symbol">{pos.symbol}</span>
                    <span class={`position-side ${pos.side}`}>{pos.side.toUpperCase()}</span>
                  </div>
                  <span class="position-shares">{pos.shares} shares @ {formatCurrency(pos.avgCost)}</span>
                </div>
                <div class="position-pnl">
                  <span class={`position-pnl-value ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                  </span>
                  <span class={`position-pnl-percent ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                    {formatPercent(pos.pnlPercent)}
                  </span>
                </div>
              </div>
            )}
          </For>
        </Section>
      </div>

      {/* Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            class="context-menu"
            style={{
              position: 'fixed',
              left: `${menu().x}px`,
              top: `${menu().y}px`,
              'z-index': 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              class="context-menu-item"
              onClick={() => openPredictionModal(menu().news)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20V10M18 20V4M6 20v-4"/>
              </svg>
              Save Prediction
            </button>
            <button
              class="context-menu-item"
              onClick={() => {
                if (menu().news.url) window.open(menu().news.url, '_blank');
                closeContextMenu();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
              Open in Browser
            </button>
          </div>
        )}
      </Show>

      {/* Prediction Modal */}
      <Show when={showPredictionModal()}>
        <div class="modal-overlay" onClick={() => setShowPredictionModal(false)}>
          <div class="modal prediction-modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Save Prediction</h3>
              <button class="btn btn-icon btn-ghost" onClick={() => setShowPredictionModal(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="modal-content">
              <Show when={selectedNewsForPrediction()}>
                {(news) => (
                  <>
                    <div class="prediction-headline">
                      <strong>News:</strong> {news().headline}
                    </div>
                    <div class="prediction-source">
                      <strong>Source:</strong> {news().source}
                    </div>

                    <div class="form-group">
                      <label>Prediction Direction</label>
                      <div class="direction-buttons">
                        <button
                          class={`direction-btn bullish ${predictionDirection() === 'bullish' ? 'active' : ''}`}
                          onClick={() => setPredictionDirection('bullish')}
                        >
                          Bullish
                        </button>
                        <button
                          class={`direction-btn neutral ${predictionDirection() === 'neutral' ? 'active' : ''}`}
                          onClick={() => setPredictionDirection('neutral')}
                        >
                          Neutral
                        </button>
                        <button
                          class={`direction-btn bearish ${predictionDirection() === 'bearish' ? 'active' : ''}`}
                          onClick={() => setPredictionDirection('bearish')}
                        >
                          Bearish
                        </button>
                      </div>
                    </div>

                    <div class="form-group">
                      <label>Timeframe (days)</label>
                      <input
                        type="number"
                        class="input"
                        value={predictionTimeframe()}
                        onInput={(e) => setPredictionTimeframe(parseInt(e.currentTarget.value) || 14)}
                        min="1"
                        max="365"
                      />
                    </div>

                    <div class="form-group">
                      <label>Summary (optional)</label>
                      <textarea
                        class="input"
                        rows="3"
                        placeholder="What does this news predict?"
                        value={predictionSummary()}
                        onInput={(e) => setPredictionSummary(e.currentTarget.value)}
                      />
                    </div>
                  </>
                )}
              </Show>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onClick={() => setShowPredictionModal(false)}>Cancel</button>
              <button class="btn btn-primary" onClick={handleSavePrediction}>Save Prediction</button>
            </div>
          </div>
        </div>
      </Show>
    </aside>
  );
};
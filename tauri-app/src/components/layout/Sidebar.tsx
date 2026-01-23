import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import { symbolStore, SymbolData } from '../../stores';
import { formatCurrency, formatPercent } from '../../utils';

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

// Mock data for watchlist with sparklines
interface WatchlistItem extends SymbolData {
  sparklineData: number[];
}

const generateSparklineData = (basePrice: number, trend: 'up' | 'down' | 'flat'): number[] => {
  const data: number[] = [];
  let price = basePrice * 0.95;
  for (let i = 0; i < 20; i++) {
    const trendFactor = trend === 'up' ? 0.003 : trend === 'down' ? -0.003 : 0;
    price = price * (1 + trendFactor + (Math.random() - 0.5) * 0.02);
    data.push(price);
  }
  return data;
};

const mockWatchlist: WatchlistItem[] = [
  { symbol: 'AAPL', price: 178.72, changePercent: 2.36, changeDirection: 'up', favorited: true, sparklineData: generateSparklineData(178, 'up') },
  { symbol: 'NVDA', price: 875.28, changePercent: 5.67, changeDirection: 'up', favorited: true, sparklineData: generateSparklineData(875, 'up') },
  { symbol: 'MSFT', price: 415.50, changePercent: -0.89, changeDirection: 'down', favorited: false, sparklineData: generateSparklineData(415, 'down') },
  { symbol: 'GOOGL', price: 141.80, changePercent: 1.23, changeDirection: 'up', favorited: false, sparklineData: generateSparklineData(141, 'up') },
  { symbol: 'AMZN', price: 178.25, changePercent: -0.56, changeDirection: 'down', favorited: false, sparklineData: generateSparklineData(178, 'down') },
  { symbol: 'META', price: 485.23, changePercent: 1.87, changeDirection: 'up', favorited: false, sparklineData: generateSparklineData(485, 'up') },
  { symbol: 'TSLA', price: 248.42, changePercent: -3.45, changeDirection: 'down', favorited: false, sparklineData: generateSparklineData(248, 'down') },
  { symbol: 'AMD', price: 178.45, changePercent: 4.12, changeDirection: 'up', favorited: false, sparklineData: generateSparklineData(178, 'up') },
];

// Mock news data
interface NewsItem {
  id: number;
  headline: string;
  source: string;
  time: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  symbols: string[];
}

const mockNews: NewsItem[] = [
  { id: 1, headline: 'NVIDIA beats Q4 earnings, raises guidance on AI demand', source: 'Reuters', time: '2m', sentiment: 'bullish', symbols: ['NVDA'] },
  { id: 2, headline: 'Apple Vision Pro sales slower than expected', source: 'Bloomberg', time: '15m', sentiment: 'bearish', symbols: ['AAPL'] },
  { id: 3, headline: 'Fed signals potential rate cuts in H2 2024', source: 'CNBC', time: '32m', sentiment: 'bullish', symbols: [] },
  { id: 4, headline: 'Tesla recalls 2M vehicles over autopilot concerns', source: 'WSJ', time: '1h', sentiment: 'bearish', symbols: ['TSLA'] },
  { id: 5, headline: 'Microsoft Azure growth accelerates to 29%', source: 'TechCrunch', time: '2h', sentiment: 'bullish', symbols: ['MSFT'] },
];

// Mock positions data
interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  side: 'long' | 'short';
}

const mockPositions: Position[] = [
  { symbol: 'NVDA', shares: 50, avgCost: 750.00, currentPrice: 875.28, pnl: 6264, pnlPercent: 16.70, side: 'long' },
  { symbol: 'AAPL', shares: 200, avgCost: 165.00, currentPrice: 178.72, pnl: 2744, pnlPercent: 8.32, side: 'long' },
  { symbol: 'MSFT', shares: 75, avgCost: 420.00, currentPrice: 415.50, pnl: -337.50, pnlPercent: -1.07, side: 'long' },
  { symbol: 'TSLA', shares: 30, avgCost: 280.00, currentPrice: 248.42, pnl: -947.40, pnlPercent: -11.28, side: 'short' },
  { symbol: 'META', shares: 40, avgCost: 450.00, currentPrice: 485.23, pnl: 1409.20, pnlPercent: 7.83, side: 'long' },
];

export const Sidebar: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');

  // Initialize symbol store with mock data on mount
  createEffect(() => {
    if (symbolStore.state.symbols.length === 0) {
      symbolStore.setSymbols(mockWatchlist);
    }
  });

  const filteredWatchlist = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return mockWatchlist;
    return mockWatchlist.filter(s => 
      s.symbol.toLowerCase().includes(query)
    );
  };

  const handleSymbolClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  const totalPnL = () => mockPositions.reduce((sum, p) => sum + p.pnl, 0);

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
        <Section title="NEWS" count={mockNews.length} defaultOpen={true}>
          <For each={mockNews}>
            {(news) => (
              <div class="news-item">
                <div class="news-header">
                  <span class="news-source">{news.source}</span>
                  <span class="news-time">{news.time}</span>
                </div>
                <div class="news-headline">{news.headline}</div>
                <div class="news-footer">
                  <SentimentBadge sentiment={news.sentiment} />
                  <Show when={news.symbols.length > 0}>
                    <div class="news-symbols">
                      <For each={news.symbols}>
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
        <Section title="POSITIONS" count={mockPositions.length} defaultOpen={true}>
          <div class="positions-summary">
            <span class="positions-label">Total P&L</span>
            <span class={`positions-total ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '+' : ''}{formatCurrency(totalPnL())}
            </span>
          </div>
          <For each={mockPositions}>
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
    </aside>
  );
};
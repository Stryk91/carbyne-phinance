import { Component, For, createSignal, createEffect, createMemo } from 'solid-js';
import { TradingChart, OHLCData } from '../components/charts';
import { symbolStore } from '../stores';
import { formatCurrency, formatPercent } from '../utils';

interface StatCard {
  label: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
}

const stats: StatCard[] = [
  { label: 'Portfolio Value', value: '$1,234,567', change: '+2.34% today', changeType: 'up' },
  { label: 'Cash Available', value: '$89,432', change: '7.2% of portfolio', changeType: 'neutral' },
  { label: "Day's P&L", value: '+$28,234', change: 'Best: NVDA +5.67%', changeType: 'up' },
  { label: 'Active Positions', value: '24', change: '18 long, 6 short', changeType: 'neutral' },
];

interface TopMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  marketCap: string;
}

const topMovers: TopMover[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875.28, change: 5.67, volume: '45.2M', marketCap: '2.16T' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 178.45, change: 4.12, volume: '32.1M', marketCap: '288.5B' },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.72, change: 2.36, volume: '58.7M', marketCap: '2.78T' },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 485.23, change: 1.87, volume: '12.4M', marketCap: '1.24T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 141.80, change: 1.23, volume: '21.3M', marketCap: '1.78T' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.25, change: -0.56, volume: '28.9M', marketCap: '1.86T' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 415.50, change: -0.89, volume: '18.2M', marketCap: '3.09T' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.42, change: -3.45, volume: '89.5M', marketCap: '791.2B' },
];

// Symbol metadata for chart display
const symbolMetadata: Record<string, { name: string; price: number; change: number }> = {
  'AAPL': { name: 'Apple Inc.', price: 178.72, change: 2.36 },
  'NVDA': { name: 'NVIDIA Corporation', price: 875.28, change: 5.67 },
  'MSFT': { name: 'Microsoft Corporation', price: 415.50, change: -0.89 },
  'GOOGL': { name: 'Alphabet Inc.', price: 141.80, change: 1.23 },
  'AMZN': { name: 'Amazon.com Inc.', price: 178.25, change: -0.56 },
  'META': { name: 'Meta Platforms Inc.', price: 485.23, change: 1.87 },
  'TSLA': { name: 'Tesla Inc.', price: 248.42, change: -3.45 },
  'AMD': { name: 'Advanced Micro Devices', price: 178.45, change: 4.12 },
};

// Generate realistic OHLC data for any symbol
const generateOHLCData = (basePrice: number, trend: 'up' | 'down' | 'flat' = 'up'): OHLCData[] => {
  const data: OHLCData[] = [];
  let price = basePrice * 0.92; // Start lower to show growth
  const startDate = new Date('2024-12-01');
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Generate realistic price movement
    const volatility = 0.02;
    const trendFactor = trend === 'up' ? 0.002 : trend === 'down' ? -0.002 : 0;
    const randomWalk = (Math.random() - 0.5) * 2 * volatility;
    
    const open = price * (1 + (Math.random() - 0.5) * 0.005);
    const close = price * (1 + randomWalk + trendFactor);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    // Generate realistic volume
    const volume = Math.floor(40000000 + Math.random() * 40000000);
    
    data.push({
      time: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });
    
    price = close;
  }
  
  return data;
};

// Cache for generated OHLC data
const ohlcCache: Record<string, OHLCData[]> = {};

const getOHLCData = (symbol: string): OHLCData[] => {
  if (!ohlcCache[symbol]) {
    const meta = symbolMetadata[symbol];
    if (meta) {
      const trend = meta.change > 0 ? 'up' : meta.change < 0 ? 'down' : 'flat';
      ohlcCache[symbol] = generateOHLCData(meta.price, trend);
    } else {
      // Default data for unknown symbols
      ohlcCache[symbol] = generateOHLCData(100, 'flat');
    }
  }
  return ohlcCache[symbol];
};

type ChartType = 'candlestick' | 'line' | 'area';
type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const Dashboard: Component = () => {
  const [chartType, setChartType] = createSignal<ChartType>('candlestick');
  const [activeTimeframe, setActiveTimeframe] = createSignal<Timeframe>('1M');
  const [showVolume, setShowVolume] = createSignal(true);

  const timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  // Reactive symbol data
  const currentSymbol = () => symbolStore.state.selectedSymbol || 'AAPL';
  
  const currentMeta = createMemo(() => {
    const sym = currentSymbol();
    return symbolMetadata[sym] || { name: sym, price: 100, change: 0 };
  });

  const chartData = createMemo(() => {
    return getOHLCData(currentSymbol());
  });

  // Calculate price info from chart data
  const priceInfo = createMemo(() => {
    const data = chartData();
    if (data.length < 2) return { change: 0, changePercent: 0 };
    const lastCandle = data[data.length - 1];
    const prevCandle = data[data.length - 2];
    const change = lastCandle.close - prevCandle.close;
    const changePercent = (change / prevCandle.close) * 100;
    return { change, changePercent, lastPrice: lastCandle.close };
  });

  // Handle row click in top movers table
  const handleMoverClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  return (
    <div class="editor-content">
      <div class="stats-grid" style={{ 'margin-bottom': 'var(--space-4)' }}>
        <For each={stats}>
          {(stat) => (
            <div class="stat-card">
              <div class="stat-label">{stat.label}</div>
              <div class={`stat-value ${stat.changeType === 'up' ? 'text-up' : ''}`}>
                {stat.value}
              </div>
              <div class={`stat-change ${stat.changeType === 'up' ? 'text-up' : stat.changeType === 'down' ? 'text-down' : 'text-muted'}`}>
                {stat.changeType === 'up' ? '▲ ' : stat.changeType === 'down' ? '▼ ' : ''}{stat.change}
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="chart-container" style={{ height: '380px', 'margin-bottom': 'var(--space-4)' }}>
        <div class="chart-toolbar">
          <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--space-4)' }}>
            <span class="chart-symbol">{currentSymbol()}</span>
            <span class="text-muted">{currentMeta().name}</span>
            <span class={priceInfo().change >= 0 ? 'text-up' : 'text-down'}>
              {formatCurrency(priceInfo().lastPrice || currentMeta().price)}
            </span>
            <span class={priceInfo().change >= 0 ? 'text-up' : 'text-down'}>
              {priceInfo().change >= 0 ? '+' : ''}{formatCurrency(priceInfo().change)} ({priceInfo().change >= 0 ? '+' : ''}{priceInfo().changePercent.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--space-3)' }}>
            {/* Chart Type Selector */}
            <div class="chart-type-selector" style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button
                class={`btn btn-icon btn-ghost ${chartType() === 'candlestick' ? 'active' : ''}`}
                onClick={() => setChartType('candlestick')}
                title="Candlestick"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 4v16M9 8h6v8H9zM15 4v16M15 6h4v4h-4zM15 14h4v4h-4z" />
                </svg>
              </button>
              <button
                class={`btn btn-icon btn-ghost ${chartType() === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                title="Line"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </button>
              <button
                class={`btn btn-icon btn-ghost ${chartType() === 'area' ? 'active' : ''}`}
                onClick={() => setChartType('area')}
                title="Area"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 20h18V10l-6 4-4-8-4 6-4 2v6z" />
                </svg>
              </button>
              <button
                class={`btn btn-icon btn-ghost ${showVolume() ? 'active' : ''}`}
                onClick={() => setShowVolume(!showVolume())}
                title="Toggle Volume"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="14" width="4" height="6" />
                  <rect x="10" y="10" width="4" height="10" />
                  <rect x="16" y="6" width="4" height="14" />
                </svg>
              </button>
            </div>
            {/* Timeframe Selector */}
            <div class="chart-timeframes">
              <For each={timeframes}>
                {(tf) => (
                  <button
                    class={`timeframe-btn ${activeTimeframe() === tf ? 'active' : ''}`}
                    onClick={() => setActiveTimeframe(tf)}
                  >
                    {tf}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
        <div class="chart-area">
          <TradingChart
            symbol={currentSymbol()}
            data={chartData()}
            chartType={chartType()}
            height={320}
            showVolume={showVolume()}
          />
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Top Movers Today</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button class="btn btn-icon btn-ghost" title="Refresh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-ghost" title="Export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        </div>
        <div style={{ 'max-height': '300px', 'overflow-y': 'auto' }}>
          <table class="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              <For each={topMovers}>
                {(stock) => (
                  <tr 
                    class={`clickable-row ${symbolStore.state.selectedSymbol === stock.symbol ? 'selected' : ''}`}
                    onClick={() => handleMoverClick(stock.symbol)}
                  >
                    <td class="mono" style={{ 'font-weight': '600' }}>{stock.symbol}</td>
                    <td>{stock.name}</td>
                    <td class="mono">{formatCurrency(stock.price)}</td>
                    <td class={`mono ${stock.change >= 0 ? 'text-up' : 'text-down'}`}>
                      {formatPercent(stock.change)}
                    </td>
                    <td>{stock.volume}</td>
                    <td>${stock.marketCap}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
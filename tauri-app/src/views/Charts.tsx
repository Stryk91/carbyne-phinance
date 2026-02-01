import { Component, For, createSignal, createResource, createMemo, createEffect, Show } from 'solid-js';
import { TradingChart, OHLCData } from '../components/charts';
import { symbolStore } from '../stores';
import { formatCurrency, formatPercent } from '../utils';
import { getSymbols, getPriceHistory, type PriceData } from '../api';

type ChartType = 'candlestick' | 'line' | 'area';
type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
type LayoutMode = 'single' | 'grid-2' | 'grid-4';

// Convert PriceData from API to OHLCData for chart
const priceDataToOHLC = (prices: PriceData[]): OHLCData[] => {
  return prices.map(p => ({
    time: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: p.volume,
  }));
};

export const Charts: Component = () => {
  const [chartType, setChartType] = createSignal<ChartType>('candlestick');
  const [activeTimeframe, setActiveTimeframe] = createSignal<Timeframe>('1M');
  const [showVolume, setShowVolume] = createSignal(true);
  const [layoutMode, setLayoutMode] = createSignal<LayoutMode>('single');
  const [selectedSymbols, setSelectedSymbols] = createSignal<string[]>([]);

  const timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  // Fetch available symbols
  const [symbolsData] = createResource(async () => {
    try {
      const symbols = await getSymbols();
      console.log('[Charts] getSymbols returned:', symbols?.length, 'symbols', symbols?.slice(0, 5));
      return symbols;
    } catch (e) {
      console.error('[Charts] getSymbols failed:', e);
      return [];
    }
  });

  // Primary symbol from store or first available
  const primarySymbol = () => symbolStore.state.selectedSymbol || symbolsData()?.[0]?.symbol || 'AAPL';

  // Get chart symbols based on layout mode
  const chartSymbols = createMemo(() => {
    const primary = primarySymbol();
    const selected = selectedSymbols();

    if (layoutMode() === 'single') {
      return [primary];
    }

    // For grid layouts, use selected symbols or fill with available ones
    const symbols = symbolsData() || [];
    const count = layoutMode() === 'grid-2' ? 2 : 4;

    const result = [primary];
    for (const s of selected) {
      if (result.length >= count) break;
      if (!result.includes(s)) result.push(s);
    }

    // Fill remaining slots with other symbols
    for (const s of symbols) {
      if (result.length >= count) break;
      if (!result.includes(s.symbol)) result.push(s.symbol);
    }

    return result.slice(0, count);
  });

  // Store chart data by symbol for grid view
  const [chartDataMap, setChartDataMap] = createSignal<Record<string, PriceData[]>>({});
  const [lastDataUpdate, setLastDataUpdate] = createSignal('');

  // Load data for all visible symbols when they change
  createEffect(() => {
    const symbols = chartSymbols();

    // Async load in effect
    (async () => {
      const newMap: Record<string, PriceData[]> = {};

      for (const symbol of symbols) {
        if (symbol) {
          try {
            const data = await getPriceHistory(symbol);
            newMap[symbol] = data;
            console.log(`[Charts] Loaded ${data.length} candles for ${symbol}`);
          } catch (e) {
            console.error(`[Charts] Failed to load ${symbol}:`, e);
            newMap[symbol] = [];
          }
        }
      }

      setChartDataMap(newMap);
      setLastDataUpdate(new Date().toLocaleTimeString());
    })();
  });

  // Filter data by timeframe
  const filterByTimeframe = (data: PriceData[]): PriceData[] => {
    if (data.length === 0) return data;

    const tf = activeTimeframe();
    const now = new Date();
    let cutoffDate: Date;

    switch (tf) {
      case '1D':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1W':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'ALL':
      default:
        return data;
    }

    return data.filter(d => new Date(d.date) >= cutoffDate);
  };

  // Get chart data for a symbol
  const getChartData = (symbol: string): OHLCData[] => {
    const data = chartDataMap()[symbol] || [];
    const filtered = filterByTimeframe(data);
    return priceDataToOHLC(filtered);
  };

  // Get price info for a symbol
  const getPriceInfo = (data: OHLCData[]) => {
    if (data.length < 2) return { change: 0, changePercent: 0, lastPrice: 0 };
    const lastCandle = data[data.length - 1];
    const prevCandle = data[data.length - 2];
    const change = lastCandle.close - prevCandle.close;
    const changePercent = (change / prevCandle.close) * 100;
    return { change, changePercent, lastPrice: lastCandle.close };
  };

  // Handle symbol selection
  const handleSymbolClick = (symbol: string) => {
    symbolStore.selectSymbol(symbol);
  };

  // Toggle symbol in grid
  const toggleSymbolInGrid = (symbol: string) => {
    const current = selectedSymbols();
    if (current.includes(symbol)) {
      setSelectedSymbols(current.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...current, symbol]);
    }
  };

  // Chart height based on layout
  const chartHeight = () => {
    switch (layoutMode()) {
      case 'single': return 500;
      case 'grid-2': return 350;
      case 'grid-4': return 280;
    }
  };

  return (
    <div class="editor-content">
      {/* Toolbar */}
      <div class="charts-toolbar">
        <div class="charts-toolbar-left">
          {/* Layout Selector */}
          <div class="layout-selector">
            <button
              class={`btn btn-icon btn-ghost ${layoutMode() === 'single' ? 'active' : ''}`}
              onClick={() => setLayoutMode('single')}
              title="Single Chart"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button
              class={`btn btn-icon btn-ghost ${layoutMode() === 'grid-2' ? 'active' : ''}`}
              onClick={() => setLayoutMode('grid-2')}
              title="2 Charts"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="8" height="18" rx="1"/>
                <rect x="13" y="3" width="8" height="18" rx="1"/>
              </svg>
            </button>
            <button
              class={`btn btn-icon btn-ghost ${layoutMode() === 'grid-4' ? 'active' : ''}`}
              onClick={() => setLayoutMode('grid-4')}
              title="4 Charts"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="8" height="8" rx="1"/>
                <rect x="13" y="3" width="8" height="8" rx="1"/>
                <rect x="3" y="13" width="8" height="8" rx="1"/>
                <rect x="13" y="13" width="8" height="8" rx="1"/>
              </svg>
            </button>
          </div>

          {/* Chart Type Selector */}
          <div class="chart-type-selector">
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
        </div>

        <div class="charts-toolbar-right">
          <Show when={lastDataUpdate()}>
            <span class="timestamp-badge">{lastDataUpdate()}</span>
          </Show>
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

      {/* Symbol Picker (for grid modes) */}
      <Show when={layoutMode() !== 'single'}>
        <div class="symbol-picker">
          <span class="symbol-picker-label">Symbols:</span>
          <div class="symbol-picker-chips">
            <For each={symbolsData() || []}>
              {(sym) => (
                <button
                  class={`symbol-chip ${chartSymbols().includes(sym.symbol) ? 'active' : ''}`}
                  onClick={() => toggleSymbolInGrid(sym.symbol)}
                >
                  {sym.symbol}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Charts Grid */}
      <div class={`charts-grid layout-${layoutMode()}`}>
        <For each={chartSymbols()}>
          {(sym: string) => {
            const data = () => getChartData(sym);
            const info = () => getPriceInfo(data());

            return (
              <div class="chart-panel" onClick={() => handleSymbolClick(sym)}>
                <div class="chart-panel-header">
                  <div class="chart-panel-symbol">
                    <span class="symbol-name">{sym}</span>
                    <Show when={info().lastPrice > 0}>
                      <span class={info().change >= 0 ? 'text-up' : 'text-down'}>
                        {formatCurrency(info().lastPrice)}
                      </span>
                      <span class={`change-badge ${info().change >= 0 ? 'up' : 'down'}`}>
                        {info().change >= 0 ? '+' : ''}{formatPercent(info().changePercent)}
                      </span>
                    </Show>
                  </div>
                </div>
                <div class="chart-panel-body">
                  <Show
                    when={data().length > 0}
                    fallback={<div class="chart-loading">Loading...</div>}
                  >
                    <TradingChart
                      symbol={sym}
                      data={data()}
                      chartType={chartType()}
                      height={chartHeight()}
                      showVolume={showVolume()}
                    />
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

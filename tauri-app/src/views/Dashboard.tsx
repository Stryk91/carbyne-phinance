import { Component, For } from 'solid-js';
import { formatCurrency, formatPercent, formatCompact } from '../utils';

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

export const Dashboard: Component = () => {
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

      <div class="chart-container" style={{ height: '350px', 'margin-bottom': 'var(--space-4)' }}>
        <div class="chart-toolbar">
          <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--space-4)' }}>
            <span class="chart-symbol">AAPL</span>
            <span class="text-muted">Apple Inc.</span>
            <span class="text-up">$178.72</span>
            <span class="text-up">+$4.12 (+2.36%)</span>
          </div>
          <div class="chart-timeframes">
            <button class="timeframe-btn">1D</button>
            <button class="timeframe-btn">1W</button>
            <button class="timeframe-btn active">1M</button>
            <button class="timeframe-btn">3M</button>
            <button class="timeframe-btn">1Y</button>
            <button class="timeframe-btn">ALL</button>
          </div>
        </div>
        <div class="chart-area" style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', color: 'var(--text-tertiary)' }}>
          <svg width="600" height="200" viewBox="0 0 600 200">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#4ec9b0;stop-opacity:0.3"/>
                <stop offset="100%" style="stop-color:#4ec9b0;stop-opacity:0"/>
              </linearGradient>
            </defs>
            <path d="M0,150 L50,140 L100,120 L150,130 L200,100 L250,90 L300,95 L350,70 L400,60 L450,80 L500,50 L550,40 L600,30 L600,200 L0,200 Z" fill="url(#chartGradient)"/>
            <path d="M0,150 L50,140 L100,120 L150,130 L200,100 L250,90 L300,95 L350,70 L400,60 L450,80 L500,50 L550,40 L600,30" fill="none" stroke="#4ec9b0" stroke-width="2"/>
            <g stroke="#3c3c3c" stroke-width="1" opacity="0.5">
              <line x1="0" y1="50" x2="600" y2="50"/>
              <line x1="0" y1="100" x2="600" y2="100"/>
              <line x1="0" y1="150" x2="600" y2="150"/>
            </g>
          </svg>
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
                  <tr>
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
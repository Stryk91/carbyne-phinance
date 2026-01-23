import { Component } from 'solid-js';
import { symbolStore } from '../../stores';
import { formatCurrency, formatPercent, formatTime } from '../../utils';

export const StatusBar: Component = () => {
  const now = new Date();

  return (
    <footer class="status-bar">
      <div class="status-left">
        <div class="status-item">
          <span class="status-dot"></span>
          <span>Market Open</span>
        </div>
        <div class="status-item">
          <span>NYSE: {formatTime(now)} EST</span>
        </div>
      </div>
      <div class="status-right">
        <div class="status-item">
          <span>Portfolio: {formatCurrency(1234567)}</span>
          <span style={{ color: '#4ec9b0' }}>{formatPercent(2.34)}</span>
        </div>
        <div class="status-item">
          <span>Symbols: {symbolStore.state.symbols.length || 0}</span>
        </div>
        <div class="status-item">
          <span>API: 23/25</span>
        </div>
        <div class="status-item">
          <span class="status-dot warning"></span>
          <span>3 Alerts</span>
        </div>
      </div>
    </footer>
  );
};
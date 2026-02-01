import { Component, createSignal, onMount, onCleanup, createResource } from 'solid-js';
import { symbolStore } from '../../stores';
import { formatCurrency, formatPercent } from '../../utils';
import { getPaperBalance, getAlerts } from '../../api';

// Get current NYSE time (Eastern Time)
const getNYSETime = (): Date => {
  const now = new Date();
  // Convert to Eastern Time
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return nyTime;
};

// Check if NYSE market is open
const isMarketOpen = (): boolean => {
  const nyTime = getNYSETime();
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market closed on weekends
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
  return timeInMinutes >= 570 && timeInMinutes < 960;
};

// Format time for display
const formatNYSETime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

export const StatusBar: Component = () => {
  const [nyseTime, setNyseTime] = createSignal(getNYSETime());
  const [marketOpen, setMarketOpen] = createSignal(isMarketOpen());

  // Fetch portfolio balance
  const [balanceData] = createResource(async () => {
    try {
      return await getPaperBalance();
    } catch {
      return null;
    }
  });

  // Fetch active alerts count
  const [alertsData] = createResource(async () => {
    try {
      const alerts = await getAlerts(true); // only active
      return alerts.length;
    } catch {
      return 0;
    }
  });

  // Update time every second
  let timer: number;
  onMount(() => {
    timer = window.setInterval(() => {
      setNyseTime(getNYSETime());
      setMarketOpen(isMarketOpen());
    }, 1000);
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  const portfolioValue = () => balanceData()?.total_equity || 0;
  const portfolioPnL = () => {
    const data = balanceData();
    if (!data) return 0;
    const startingCapital = 1000000; // Should match DB config
    return ((data.total_equity - startingCapital) / startingCapital) * 100;
  };
  const activeAlerts = () => alertsData() || 0;

  return (
    <footer class="status-bar">
      <div class="status-left">
        <div class="status-item">
          <span class={`status-dot ${marketOpen() ? '' : 'closed'}`}></span>
          <span>{marketOpen() ? 'Market Open' : 'Market Closed'}</span>
        </div>
        <div class="status-item">
          <span>NYSE: {formatNYSETime(nyseTime())} ET</span>
        </div>
      </div>
      <div class="status-right">
        <div class="status-item">
          <span>Portfolio: {formatCurrency(portfolioValue())}</span>
          <span style={{ color: portfolioPnL() >= 0 ? '#4ec9b0' : '#f14c4c' }}>
            {portfolioPnL() >= 0 ? '+' : ''}{formatPercent(portfolioPnL())}
          </span>
        </div>
        <div class="status-item">
          <span>Symbols: {symbolStore.state.symbols.length || 0}</span>
        </div>
        <div class="status-item">
          <span class={`status-dot ${activeAlerts() > 0 ? 'warning' : ''}`}></span>
          <span>{activeAlerts()} Alert{activeAlerts() !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </footer>
  );
};
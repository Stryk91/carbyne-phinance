import { createStore } from 'solid-js/store';
import { invoke } from '@tauri-apps/api/core';

export type TeamType = 'KALIC' | 'DC';

interface SettingsState {
  // API Keys
  finnhubApiKey: string;
  claudeApiKey: string;

  // Team selection for portfolio view
  activeTeam: TeamType;

  // UI preferences
  autoRefreshInterval: number; // seconds, 0 = disabled
  showSparklines: boolean;
}

// Try to load from localStorage
const loadSettings = (): Partial<SettingsState> => {
  try {
    const saved = localStorage.getItem('fp_settings');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const savedSettings = loadSettings();

const initialState: SettingsState = {
  finnhubApiKey: savedSettings.finnhubApiKey || '',
  claudeApiKey: savedSettings.claudeApiKey || '',
  activeTeam: savedSettings.activeTeam || 'KALIC',
  autoRefreshInterval: savedSettings.autoRefreshInterval || 600,
  showSparklines: savedSettings.showSparklines ?? true,
};

const [state, setState] = createStore<SettingsState>(initialState);

// Persist to localStorage on changes
const saveSettings = () => {
  try {
    localStorage.setItem('fp_settings', JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

// Load Finnhub key from disk config (survives rebuilds)
const loadFinnhubKeyFromDisk = async () => {
  try {
    const key = await invoke<string | null>('load_finnhub_key');
    if (key && !state.finnhubApiKey) {
      setState('finnhubApiKey', key);
      saveSettings();
    }
  } catch {
    // Tauri not available or config doesn't exist yet
  }
};

// Auto-load on startup
loadFinnhubKeyFromDisk();

export const settingsStore = {
  state,

  setFinnhubApiKey(key: string) {
    setState('finnhubApiKey', key);
    saveSettings();
    // Also persist to disk config
    invoke('save_finnhub_key', { key }).catch(() => {});
  },

  setClaudeApiKey(key: string) {
    setState('claudeApiKey', key);
    saveSettings();
  },

  setActiveTeam(team: TeamType) {
    setState('activeTeam', team);
    saveSettings();
  },

  toggleTeam() {
    const newTeam = state.activeTeam === 'KALIC' ? 'DC' : 'KALIC';
    setState('activeTeam', newTeam);
    saveSettings();
    return newTeam;
  },

  setAutoRefreshInterval(seconds: number) {
    setState('autoRefreshInterval', Math.max(0, seconds));
    saveSettings();
  },

  toggleSparklines() {
    setState('showSparklines', !state.showSparklines);
    saveSettings();
  },

  // Check if we have the required API keys
  hasFinnhubKey(): boolean {
    return state.finnhubApiKey.length > 0;
  },

  hasClaudeKey(): boolean {
    return state.claudeApiKey.length > 0;
  },
};

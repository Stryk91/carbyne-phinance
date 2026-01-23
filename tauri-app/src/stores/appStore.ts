import { createStore } from 'solid-js/store';

export type ViewType = 
  | 'dashboard' 
  | 'symbols' 
  | 'charts' 
  | 'portfolio' 
  | 'ai-trader' 
  | 'alerts' 
  | 'settings';

export type PanelTab = 'log' | 'alerts' | 'ai-chat';

interface AppState {
  activeView: ViewType;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  panelHeight: number;
  panelCollapsed: boolean;
  panelTab: PanelTab;
  commandPaletteOpen: boolean;
}

const initialState: AppState = {
  activeView: 'dashboard',
  sidebarWidth: 260,
  sidebarCollapsed: false,
  panelHeight: 200,
  panelCollapsed: false,
  panelTab: 'log',
  commandPaletteOpen: false,
};

const [state, setState] = createStore<AppState>(initialState);

export const appStore = {
  state,
  
  setView(view: ViewType) {
    setState('activeView', view);
  },
  
  setSidebarWidth(width: number) {
    setState('sidebarWidth', Math.min(Math.max(180, width), 400));
  },
  
  toggleSidebar() {
    setState('sidebarCollapsed', !state.sidebarCollapsed);
  },
  
  setPanelHeight(height: number) {
    setState('panelHeight', Math.min(Math.max(100, height), 500));
  },
  
  togglePanel() {
    setState('panelCollapsed', !state.panelCollapsed);
  },
  
  setPanelTab(tab: PanelTab) {
    setState('panelTab', tab);
  },
  
  openCommandPalette() {
    setState('commandPaletteOpen', true);
  },
  
  closeCommandPalette() {
    setState('commandPaletteOpen', false);
  },
  
  toggleCommandPalette() {
    setState('commandPaletteOpen', !state.commandPaletteOpen);
  },
};
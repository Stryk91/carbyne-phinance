import { createStore } from 'solid-js/store';

export type ViewType = 
  | 'dashboard' 
  | 'symbols' 
  | 'charts' 
  | 'portfolio' 
  | 'ai-trader' 
  | 'alerts' 
  | 'settings';

export type PanelTab = 'terminal' | 'problems' | 'output';

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
  panelTab: 'terminal',
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
  
  showPanel() {
    setState('panelCollapsed', false);
  },
  
  setPanelTab(tab: PanelTab) {
    setState('panelTab', tab);
    // Auto-show panel when switching tabs
    if (state.panelCollapsed) {
      setState('panelCollapsed', false);
    }
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
  
  // Focus terminal (called from keyboard shortcut)
  focusTerminal() {
    setState('panelCollapsed', false);
    setState('panelTab', 'terminal');
    // Use the exposed function from Panel component
    setTimeout(() => {
      if ((window as any).__focusTerminal) {
        (window as any).__focusTerminal();
      }
    }, 50);
  },
};

// Keyboard shortcuts handler
export const setupKeyboardShortcuts = () => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Shift+P - Command Palette
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      appStore.toggleCommandPalette();
      return;
    }
    
    // Ctrl+B - Toggle Sidebar
    if (e.ctrlKey && !e.shiftKey && e.key === 'b') {
      e.preventDefault();
      appStore.toggleSidebar();
      return;
    }
    
    // Ctrl+J - Toggle Bottom Panel
    if (e.ctrlKey && !e.shiftKey && e.key === 'j') {
      e.preventDefault();
      appStore.togglePanel();
      return;
    }
    
    // Ctrl+` - Focus Terminal
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      appStore.focusTerminal();
      return;
    }
    
    // Escape - Close command palette
    if (e.key === 'Escape') {
      if (state.commandPaletteOpen) {
        e.preventDefault();
        appStore.closeCommandPalette();
      }
      return;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
};
import { createStore } from 'solid-js/store';

export interface SymbolData {
  symbol: string;
  price: number;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'unchanged';
  favorited: boolean;
}

export interface Watchlist {
  id: number;
  name: string;
  description: string | null;
  symbols: string[];
}

interface SymbolState {
  symbols: SymbolData[];
  favorites: string[];
  watchlists: Watchlist[];
  selectedSymbol: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: SymbolState = {
  symbols: [],
  favorites: [],
  watchlists: [],
  selectedSymbol: null,
  loading: false,
  error: null,
};

const [state, setState] = createStore<SymbolState>(initialState);

export const symbolStore = {
  state,
  
  setSymbols(symbols: SymbolData[]) {
    setState('symbols', symbols);
  },
  
  updateSymbol(symbol: string, data: Partial<SymbolData>) {
    setState('symbols', s => s.symbol === symbol, data);
  },
  
  setFavorites(favorites: string[]) {
    setState('favorites', favorites);
  },
  
  toggleFavorite(symbol: string) {
    const isFavorited = state.favorites.includes(symbol);
    if (isFavorited) {
      setState('favorites', state.favorites.filter(s => s !== symbol));
    } else {
      setState('favorites', [...state.favorites, symbol]);
    }
    return !isFavorited;
  },
  
  setWatchlists(watchlists: Watchlist[]) {
    setState('watchlists', watchlists);
  },
  
  selectSymbol(symbol: string | null) {
    setState('selectedSymbol', symbol);
  },
  
  setLoading(loading: boolean) {
    setState('loading', loading);
  },
  
  setError(error: string | null) {
    setState('error', error);
  },
  
  getSymbolsByChange(direction: 'up' | 'down') {
    return state.symbols
      .filter(s => s.changeDirection === direction)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  },
  
  getFavoriteSymbols() {
    return state.symbols.filter(s => state.favorites.includes(s.symbol));
  },
};
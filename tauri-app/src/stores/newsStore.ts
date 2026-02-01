import { createStore } from 'solid-js/store';

export interface NewsDetail {
  headline: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  symbol: string;
}

interface NewsState {
  selectedNews: NewsDetail | null;
  showDetail: boolean;
}

const initialState: NewsState = {
  selectedNews: null,
  showDetail: false,
};

const [state, setState] = createStore<NewsState>(initialState);

export const newsStore = {
  state,

  selectNews(news: NewsDetail) {
    setState('selectedNews', news);
    setState('showDetail', true);
  },

  closeDetail() {
    setState('showDetail', false);
    setState('selectedNews', null);
  },

  toggleDetail() {
    setState('showDetail', !state.showDetail);
  },
};

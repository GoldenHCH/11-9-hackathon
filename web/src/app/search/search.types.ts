import { searchTabs } from './search.constants';

export type SearchTab = (typeof searchTabs)[number]['id'];

export type ConnectState = 'connect' | 'sending' | 'waiting' | 'respond' | 'open';

export type AnswerState = 'idle' | 'loading' | 'ready' | 'fallback';

export interface IAnswerSegment {
  text: string;
  citation?: number;
}

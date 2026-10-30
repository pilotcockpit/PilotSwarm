// Typed surface of packages/app/ui/core/src/history.js that Flight Deck uses.
export interface ChatItem {
  id: string;
  role: string;
  kind?: string;
  text?: string;
  time?: string;
  createdAt?: number;
  [key: string]: any;
}
export interface HistoryModel {
  chat: ChatItem[];
  activity: Array<{ id?: string; text?: string; time?: string; eventType?: string; [key: string]: any }>;
  events: any[];
  lastSeq?: number;
  [key: string]: any;
}
export declare const CHAT_HISTORY_EVENT_TYPES: string[];
export declare function buildHistoryModel(events: any[], options?: Record<string, unknown>): HistoryModel;
export declare function appendEventToHistory(history: HistoryModel, event: any): HistoryModel;

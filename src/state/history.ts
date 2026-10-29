import type { Position } from '../types';
import { validatePosition } from './position-data';

export const HISTORY_LIMIT = 1000;
export interface ReadingHistory { entries: Position[]; index: number }
export type VisitMode = 'append' | 'replace';
export function sameChapter(a: Position | null, b: Position): boolean {
 return a?.translationId === b.translationId && a.bookId === b.bookId && a.chapter === b.chapter;
}
export function parseReadingHistory(text: string): ReadingHistory {
 const value: unknown = JSON.parse(text);
 if (!value || typeof value !== 'object' || !('schemaVersion' in value)) throw new Error('Invalid reading state.');
 if (value.schemaVersion === 1 && 'position' in value) return { entries: [validatePosition(value.position)], index: 0 };
 if (value.schemaVersion !== 2 || !('history' in value) || !Array.isArray(value.history) || !('index' in value) || typeof value.index !== 'number' || !Number.isInteger(value.index)) {
  throw new Error('Unsupported reading history. Expected schema version 1 or 2.');
 }
 if (value.history.length > HISTORY_LIMIT || value.index < -1 || value.index >= value.history.length || (value.history.length > 0 && value.index < 0)) {
  throw new Error('Invalid reading history length or cursor.');
 }
 return { entries: value.history.map(validatePosition), index: value.index };
}
export function serializeReadingHistory(history: ReadingHistory): string {
 const text = JSON.stringify({ schemaVersion: 2, history: history.entries, index: history.index }, null, 2) + '\n';
 parseReadingHistory(text);
 return text;
}
export function visitHistory(history: ReadingHistory, position: Position, mode: VisitMode): ReadingHistory {
 const next = validatePosition(position);
 if (history.index >= 0 && (mode === 'replace' || sameChapter(history.entries[history.index] ?? null, next))) {
  const entries = [...history.entries];
  entries[history.index] = next;
  return { entries, index: history.index };
 }
 const entries = [...history.entries.slice(0, history.index + 1), next].slice(-HISTORY_LIMIT);
 return { entries, index: entries.length - 1 };
}

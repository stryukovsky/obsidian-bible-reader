import { BOOK_REGISTRY } from '../sword/canon';
import { validChapterPath } from '../reader/paths';
import type { Position } from '../types';

export function validatePosition(position: unknown): Position {
 if (!position || typeof position !== 'object' || !('translationId' in position) || !('bookId' in position) || !('chapter' in position) ||
  typeof position.translationId !== 'string' || !/^[A-Za-z0-9_]+$/.test(position.translationId) ||
  typeof position.bookId !== 'string' || !Number.isInteger(position.chapter) || typeof position.chapter !== 'number') {
  throw new Error('Invalid reading position.');
 }
 const book = BOOK_REGISTRY.find(book => book.id === position.bookId);
 if (!book || position.chapter < 1 || position.chapter > book.verses.length) throw new Error('Unknown book or invalid chapter in reading state.');
 const result: Position = { translationId: position.translationId, bookId: position.bookId, chapter: position.chapter };
 if ('scrollPercent' in position) {
  if (typeof position.scrollPercent !== 'number' || !Number.isFinite(position.scrollPercent) || position.scrollPercent < 0 || position.scrollPercent > 100) throw new Error('Invalid scroll percentage.');
  result.scrollPercent = position.scrollPercent;
 }
 if ('path' in position) {
  if (typeof position.path !== 'string' || !validChapterPath(position.path, result)) throw new Error('Invalid saved chapter path.');
  result.path = position.path;
 }
 return result;
}

export function serializePosition(position: Position): string {
 const valid = validatePosition(position);
 return JSON.stringify({ schemaVersion: 1, position: valid }, null, 2) + '\n';
}

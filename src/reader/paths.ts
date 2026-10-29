import { BOOK_REGISTRY } from '../sword/canon';
import type { Position } from '../types';
import type { Storage } from '../library/storage';

export const BIBLE_ROOT = 'Bible';
function bookFor(position: Position) {
 return BOOK_REGISTRY.find(book => book.id === position.bookId);
}
export function validChapterPath(path: string, position: Position): boolean {
 const book = bookFor(position);
 return !!book && path.startsWith(`${BIBLE_ROOT}/${position.translationId}/${book.name}/`) &&
  path.split('/').length === 4 && path.endsWith('.md') &&
  !/[\\:]/.test(path) && !Array.from(path).some(char => char.charCodeAt(0) < 32) && !path.split('/').some(part => !part || part === '.' || part === '..');
}
export function chapterPath(position: Position): string {
 const book = bookFor(position);
 if (!book || !/^[A-Za-z0-9_]+$/.test(position.translationId) || !Number.isInteger(position.chapter) || position.chapter < 1 || position.chapter > book.verses.length) throw new Error('Invalid Bible chapter reference.');
 if (position.path !== undefined) {
  if (!validChapterPath(position.path, position)) throw new Error('Invalid Bible chapter file path.');
  return position.path;
 }
 return `${BIBLE_ROOT}/${position.translationId}/${book.name}/${position.chapter}.md`;
}
export function positionFromPath(path: string): Position | null {
 const match = /^Bible\/([A-Za-z0-9_]+)\/([^/]+)\/([1-9]\d*)(?:[ ._-].+)?\.md$/.exec(path);
 if (!match) return null;
 const book = BOOK_REGISTRY.find(book => book.name === match[2]);
 const chapter = Number(match[3]);
 if (!book || chapter > book.verses.length) return null;
 const position: Position = { translationId: match[1] ?? '', bookId: book.id, chapter };
 if (!validChapterPath(path, position)) return null;
 if (path !== chapterPath(position)) position.path = path;
 return position;
}
function scalar(value: string): string {
 const clean = value.trim();
 if (clean.startsWith('"') && clean.endsWith('"')) {
  const parsed: unknown = JSON.parse(clean);
  return typeof parsed === 'string' ? parsed : '';
 }
 return clean.startsWith("'") && clean.endsWith("'") ? clean.slice(1, -1).replace(/''/g, "'") : clean;
}
export function positionFromMarkdown(path: string, text: string): Position | null {
 const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
 if (!frontmatter) return positionFromPath(path);
 const fields: Record<string, string> = {};
 for (const line of (frontmatter[1] ?? '').split(/\r?\n/)) {
  const field = /^(bible-translation|bible-book|bible-chapter):\s*(.*?)\s*$/.exec(line);
  if (field?.[1]) fields[field[1]] = scalar(field[2] ?? '');
 }
 if (!Object.keys(fields).length) return positionFromPath(path);
 const position: Position = { translationId: fields['bible-translation'] ?? '', bookId: fields['bible-book'] ?? '', chapter: Number(fields['bible-chapter']) };
 try {
  const canonical = chapterPath(position);
  if (!validChapterPath(path, position)) return null;
  if (path !== canonical) position.path = path;
  return position;
 } catch { return null; }
}
export async function resolveChapter(storage: Storage, position: Position): Promise<Position | null> {
 const exact = await storage.read(chapterPath(position));
 if (exact !== null) {
  const identified = positionFromMarkdown(chapterPath(position), exact);
  if (identified && (identified.translationId !== position.translationId || identified.bookId !== position.bookId || identified.chapter !== position.chapter)) throw new Error('The saved file has different Bible reference properties. Open the intended chapter to update reading history.');
  return position;
 }
 const canonical = { ...position };
 delete canonical.path;
 const folder = chapterPath(canonical).split('/').slice(0, -1).join('/');
 const { files } = await storage.list(folder);
 const candidates: Position[] = [];
 for (const path of files) {
  if (!path.endsWith('.md') || !validChapterPath(path, position)) continue;
  const text = await storage.read(path);
  const found = text === null ? null : positionFromMarkdown(path, text);
  if (found && found.translationId === position.translationId && found.bookId === position.bookId && found.chapter === position.chapter) candidates.push({ ...position, path });
 }
 if (candidates.length > 1) throw new Error(`Several files match ${position.translationId} ${position.bookId} ${position.chapter}. Open the intended chapter to save its exact path.`);
 return candidates[0] ?? null;
}

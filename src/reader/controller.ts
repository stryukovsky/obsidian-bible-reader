import type { Storage } from '../library/storage';
import { TranslationLibrary } from '../library/library';
import { sameChapter } from '../state/history';
import { PositionStore } from '../state/position';
import type { Position } from '../types';
import { firstChapter } from './markdown';
import { chapterPath, positionFromPath, positionFromMarkdown, resolveChapter } from './paths';

export class ReaderController {
 readonly library: TranslationLibrary;
 readonly state: PositionStore;
 localPosition: Position | null = null;
 private navigation = 0;
 private opening: string | null = null;
 private stopped = false;
 private historyQueue: Promise<unknown> = Promise.resolve();
 constructor(private storage: Storage, private openFile: (path: string) => Promise<void>, private restore: (path: string, percent: number) => Promise<void> = () => Promise.resolve()) {
  this.library = new TranslationLibrary(storage);
  this.state = new PositionStore(storage);
 }
 async fileOpened(path: string | null): Promise<void> {
  const navigation = ++this.navigation;
  if (this.stopped || path === this.opening) return;
  if (!path || !path.startsWith('Bible/')) return;
  const text = await this.storage.read(path);
  const position = text === null ? positionFromPath(path) : positionFromMarkdown(path, text);
  if (!position) return;
  await this.state.load();
  if (this.stopped || navigation !== this.navigation) return;
  const saved = this.state.position;
  const expected = this.state.snapshot;
  this.localPosition = saved && sameChapter(saved, position) && chapterPath(saved) === chapterPath(position) ? saved : position;
  if (!this.state.blocked && saved && sameChapter(saved, position) && chapterPath(saved) === chapterPath(position)) return;
  const next = saved ? await this.isNextChapter(saved, position) : false;
  if (this.stopped || navigation !== this.navigation) return;
  if (expected !== this.state.snapshot) throw new Error('Reading history changed while navigating. Open the chapter again.');
  await this.state.save(position, next ? 'replace' : 'append');
 }
 async openSaved(): Promise<boolean> {
  if (this.stopped) return false;
  await this.state.load();
  await this.state.externalChange();
  if (this.state.blocked) throw new Error(this.state.issue);
  const expected = this.state.snapshot;
  let position = this.state.position ?? await firstChapter(this.storage);
  if (!position) return false;
  const saved = position;
  position = await this.resolveChapter(position);
  if (!position) throw new Error(`Saved chapter is missing: ${chapterPath(saved)}. Sync your Bible Markdown files or import the translation. The saved position was preserved.`);
  await this.openPosition(position);
  if (this.state.snapshot !== expected) throw new Error('Reading history changed while resuming. Select the Bible button again.');
  if (!this.state.position) await this.state.save(position);
  else if (chapterPath(saved) !== chapterPath(position)) await this.state.save(position, 'replace');
  if (sameChapter(this.state.position, position)) this.localPosition = this.state.position;
  return true;
 }
 resolveChapter(position: Position): Promise<Position | null> { return resolveChapter(this.storage, position); }
 private async isNextChapter(from: Position, to: Position): Promise<boolean> {
  if (from.translationId !== to.translationId) return false;
  if (from.bookId === to.bookId && to.chapter === from.chapter + 1) return true;
  const text = await this.storage.read(chapterPath(from));
  if (!text) return false;
  return Array.from(text.matchAll(/\[\[([^\]|]+)\|Next chapter\]\]/g)).some(match => `${match[1]}.md` === chapterPath(to));
 }
 private async openPosition(position: Position): Promise<void> {
  const path = chapterPath(position);
  if (await this.storage.read(path) === null) throw new Error(`Bible chapter is missing: ${path}. Reading history was preserved.`);
  this.opening = path;
  try { await this.openFile(path); await this.restore(path, position.scrollPercent ?? 0); }
  finally { this.opening = null; }
 }
 moveHistory(step: -1 | 1): Promise<boolean> {
  const action = this.historyQueue.then(async () => {
   if (this.stopped) return false;
   await this.state.load();
   await this.state.externalChange();
   if (this.state.blocked) throw new Error(this.state.issue);
   const expected = this.state.snapshot;
   let position = expected.entries[expected.index + step];
   if (!position) return false;
   const resolved = await this.resolveChapter(position);
   if (!resolved) throw new Error(`Bible chapter is missing: ${chapterPath(position)}. Reading history was preserved.`);
   position = resolved;
   await this.openPosition(position);
   await this.state.travel(step, expected);
   const active = this.state.position;
   if (active && sameChapter(active, position) && chapterPath(active) !== chapterPath(position)) await this.state.save(position, 'replace');
   this.localPosition = this.state.position;
   return true;
  });
  this.historyQueue = action.catch(() => {});
  return action;
 }
 async saveScroll(path: string, percent: number, base: Position): Promise<void> {
  if (this.stopped || this.opening || this.state.blocked || this.state.pending || this.state.position !== base || chapterPath(base) !== path) return;
  const scrollPercent = Math.round(Math.max(0, Math.min(100, percent)) * 100) / 100;
  if (scrollPercent === (base.scrollPercent ?? 0)) return;
  this.localPosition = { ...base, scrollPercent };
  await this.state.save(this.localPosition, 'replace');
 }
 stop(): void {
  this.stopped = true;
  this.navigation++;
  this.state.stop();
  this.library.stop();
 }
}

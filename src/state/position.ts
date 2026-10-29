import { STATE_PATH, type Storage } from '../library/storage';
import { errorMessage, type Position } from '../types';
import { parseReadingHistory, serializeReadingHistory, visitHistory, type ReadingHistory, type VisitMode } from './history';
export { serializePosition } from './position-data';

export function parsePosition(text: string): Position {
 const history = parseReadingHistory(text);
 const position = history.entries[history.index];
 if (!position) throw new Error('Reading history is empty.');
 return position;
}
export class PositionStore {
 private current: ReadingHistory = { entries: [], index: -1 };
 get position(): Position | null { return this.current.entries[this.current.index] ?? null; }
 get history(): readonly Position[] { return this.current.entries; }
 get historyIndex(): number { return this.current.index; }
 get snapshot(): ReadingHistory { return this.current; }
 get canGoBack(): boolean { return !this.blocked && this.current.index > 0; }
 get canGoForward(): boolean { return !this.blocked && this.current.index + 1 < this.current.entries.length; }
 incoming: Position | null = null;
 issue = '';
 blocked = false;
 pending = 0;
 private base: string | null = null;
 private writing: string | null = null;
 private listeners = new Set<() => void>();
 private queue: Promise<void> = Promise.resolve();
 private loaded?: Promise<void>;
 private stopped = false;
 constructor(private storage: Pick<Storage, 'read' | 'write'>) {}

 subscribe(listener: () => void): () => void {
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);
 }
 stop(): void { this.stopped = true; this.listeners.clear(); }
 private notify(): void { if (!this.stopped) for (const listener of this.listeners) listener(); }
 load(): Promise<void> {
  if (!this.loaded) this.loaded = this.readInitial();
  return this.loaded;
 }
 private async readInitial(): Promise<void> {
  try { this.accept(await this.storage.read(STATE_PATH)); }
  catch (error) { this.fail(error); }
 }
 private fail(error: unknown): void {
  this.issue = errorMessage(error);
  this.blocked = true;
  this.notify();
 }
 private accept(text: string | null): void {
  const history = text === null ? { entries: [], index: -1 } : parseReadingHistory(text);
  this.base = text;
  this.current = history;
  this.incoming = null;
  this.issue = '';
  this.blocked = false;
  this.notify();
 }
 async externalChange(): Promise<void> {
  await this.load();
  try {
   const text = await this.storage.read(STATE_PATH);
   if ((!this.blocked && text === this.base) || (this.writing !== null && text === this.writing)) return;
   if (text === null) { this.fail(new Error('Reading state was deleted. Restore it or explicitly save your current position.')); return; }
   const history = parseReadingHistory(text);
   if (this.pending > 0) {
    this.incoming = history.entries[history.index] ?? null;
    this.fail(new Error('A synced reading history arrived while a local save was pending. Choose which state to keep.'));
   } else this.accept(text);
  } catch (error) { this.fail(error); }
 }
 save(position: Position, mode: VisitMode = 'append'): Promise<void> {
  return this.commit(visitHistory(this.current, position, mode));
 }
 travel(step: -1 | 1, expected: ReadingHistory = this.current): Promise<void> {
  if (expected !== this.current) return Promise.reject(new Error('Reading history changed while opening the chapter. Select the history button again.'));
  const index = this.current.index + step;
  if (index < 0 || index >= this.current.entries.length) return Promise.resolve();
  return this.commit({ entries: this.current.entries, index });
 }
 private commit(history: ReadingHistory): Promise<void> {
  if (this.stopped) return Promise.resolve();
  if (this.blocked) return Promise.reject(new Error(this.issue || 'Resolve reading history before saving.'));
  const text = serializeReadingHistory(history);
  this.current = history;
  this.pending++;
  this.notify();
  const task = this.queue.then(async () => {
   if (this.stopped) return;
   if (this.blocked) throw new Error(this.issue);
   const current = await this.storage.read(STATE_PATH);
   if (current !== this.base) {
    if (current) { const incoming = parseReadingHistory(current); this.incoming = incoming.entries[incoming.index] ?? null; }
    throw new Error('Reading state changed outside the reader. Choose which state to keep.');
   }
   if (text === current) return;
   this.writing = text;
   try {
    await this.storage.write(STATE_PATH, text);
    this.base = text;
    this.issue = '';
   } finally { this.writing = null; }
  }).catch((error: unknown) => { this.fail(error); throw error; }).finally(() => {
   this.pending--;
   this.notify();
  });
  this.queue = task.catch(() => {});
  return task;
 }
 async useIncoming(): Promise<void> {
  await this.queue;
  try {
   const text = await this.storage.read(STATE_PATH);
   if (text === null) throw new Error('No incoming state exists. Open a chapter to create a new position.');
   this.accept(text);
  } catch (error) { this.fail(error); }
 }
 async keepLocal(position: Position): Promise<void> {
  await this.queue;
  const current = await this.storage.read(STATE_PATH);
  if (current !== null) await this.storage.write(`Bible reader/state-backup-${Date.now()}.json`, current);
  this.base = current;
  this.blocked = false;
  this.issue = '';
  this.incoming = null;
  await this.save(position, 'replace');
 }
}

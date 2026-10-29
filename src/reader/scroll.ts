import { MarkdownView, Notice, type Plugin } from 'obsidian';
import type { Position } from '../types';
import { errorMessage } from '../types';
import { chapterPath, positionFromPath } from './markdown';
import type { ReaderController } from './controller';

interface ScrollTarget { path: string; element: HTMLElement }
export function scrollPercent(element: Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollTop'>): number {
 const height = element.scrollHeight - element.clientHeight;
 return height > 0 ? Math.round(Math.max(0, Math.min(1, element.scrollTop / height)) * 10000) / 100 : 0;
}
export function applyScrollPercent(element: HTMLElement, percent: number): void {
 element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight) * Math.max(0, Math.min(100, percent)) / 100;
}

export class ScrollTracker {
 private dirty?: { path: string; percent: number; base: Position };
 private restoring = false;
 private stopped = false;
 private restoration = 0;
 constructor(private reader: ReaderController, private target: () => ScrollTarget | null, private wait: () => Promise<void>) {}
 capture(element: EventTarget | null): void {
  if (this.stopped || this.restoring || this.reader.state.blocked) return;
  const target = this.target();
  const base = this.reader.state.position;
  if (!target || target.element !== element || !base || chapterPath(base) !== target.path) return;
  this.dirty = { path: target.path, percent: scrollPercent(target.element), base };
 }
 async flush(): Promise<void> {
  const dirty = this.dirty;
  this.dirty = undefined;
  if (this.stopped || this.restoring || !dirty) return;
  const target = this.target();
  if (!target || target.path !== dirty.path) return;
  await this.reader.saveScroll(dirty.path, dirty.percent, dirty.base);
 }
 async restore(path: string, percent: number): Promise<void> {
  const restoration = ++this.restoration;
  this.restoring = true;
  this.dirty = undefined;
  try {
   // Standard editor/preview layout may finish after openFile resolves.
   for (let attempt = 0; attempt < 5; attempt++) {
    await this.wait();
    if (this.stopped || restoration !== this.restoration) return;
    const target = this.target();
    if (!target) continue;
    if (target.path !== path) return;
    applyScrollPercent(target.element, percent);
   }
  } finally { if (restoration === this.restoration) this.restoring = false; }
 }
 stop(): void { this.restoration++; this.stopped = true; this.dirty = undefined; }
}

export function registerScrollTracking(plugin: Plugin, reader: ReaderController): ScrollTracker {
 const target = (): ScrollTarget | null => {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view?.file) return null;
  const current = reader.state.position;
  if (!positionFromPath(view.file.path) && (!current || chapterPath(current) !== view.file.path)) return null;
  const selector = view.getMode() === 'preview' ? '.markdown-preview-view' : '.cm-scroller';
  const element = view.contentEl.querySelector<HTMLElement>(selector);
  return element ? { path: view.file.path, element } : null;
 };
 const waiting = new Map<number, () => void>();
 plugin.register(() => {
  for (const [id, resolve] of waiting) { window.clearTimeout(id); resolve(); }
  waiting.clear();
 });
 const tracker = new ScrollTracker(reader, target, () => new Promise(resolve => {
  const id = window.setTimeout(() => { waiting.delete(id); resolve(); }, 100);
  waiting.set(id, resolve);
 }));
 const documents = new WeakSet<Document>();
 const listen = (): void => {
  const document = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.containerEl.ownerDocument;
  if (!document || documents.has(document)) return;
  documents.add(document);
  plugin.registerDomEvent(document, 'scroll', event => tracker.capture(event.target), true);
 };
 plugin.app.workspace.onLayoutReady(listen);
 plugin.registerEvent(plugin.app.workspace.on('active-leaf-change', listen));
 plugin.registerEvent(plugin.app.workspace.on('file-open', listen));
 plugin.registerInterval(window.setInterval(() => {
  void tracker.flush().catch((error: unknown) => { new Notice(`Scroll position was not saved: ${errorMessage(error)}`); });
 }, 5000));
 plugin.register(() => tracker.stop());
 return tracker;
}

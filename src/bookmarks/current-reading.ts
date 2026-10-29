import { chapterPath } from '../reader/markdown';
import type { Position } from '../types';
import type { PositionStore } from '../state/position';

export const CURRENT_READING_BOOKMARK = 'Current Bible reading';
export interface CoreBookmarks {
 items: unknown[];
 onItemsChanged(save: boolean): unknown;
}
function record(value: unknown): value is Record<string, unknown> {
 return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Bookmarks currently has no public API. Keep the guarded internal dependency here.
// Verified against the Bookmarks core adapter in SebastianMC/obsidian-custom-sort.
export function coreBookmarks(app: unknown): CoreBookmarks | null {
 if (!record(app) || !record(app.internalPlugins)) return null;
 const registry = app.internalPlugins;
 if (typeof registry.getPluginById !== 'function') return null;
 const installed: unknown = registry.getPluginById.call(registry, 'bookmarks');
 if (!record(installed) || installed.enabled !== true) return null;
 const instance = installed.instance;
 if (!isCoreBookmarks(instance)) return null;
 return {
  items: instance.items,
  onItemsChanged: async save => {
   await instance.onItemsChanged(save);
   refreshBookmarkViews(app);
  },
 };
}
function refreshBookmarkViews(app: Record<string, unknown>): void {
 const workspace = app.workspace;
 if (!record(workspace) || typeof workspace.getLeavesOfType !== 'function') return;
 const leaves: unknown = workspace.getLeavesOfType.call(workspace, 'bookmarks');
 if (!Array.isArray(leaves)) return;
 for (const leaf of leaves as unknown[]) {
  if (!record(leaf) || !record(leaf.view) || typeof leaf.view.update !== 'function') continue;
  leaf.view.update.call(leaf.view);
 }
}
function isCoreBookmarks(value: unknown): value is CoreBookmarks {
 return record(value) && Array.isArray(value.items) && typeof value.onItemsChanged === 'function';
}
function findCurrent(items: unknown[]): Record<string, unknown> | null {
 const pending = [...items];
 const visited = new Set<object>();
 let index = 0;
 while (index < pending.length) {
  const item = pending[index++];
  if (!record(item) || visited.has(item)) continue;
  visited.add(item);
  if (item.type === 'file' && item.title === CURRENT_READING_BOOKMARK) return item;
  if (item.type === 'group' && Array.isArray(item.items)) {
   const children: unknown[] = item.items;
   for (const child of children) pending.push(child);
  }
 }
 return null;
}
export function updateCurrentBookmark(core: CoreBookmarks, path: string, now: () => number = Date.now): boolean {
 const bookmark = findCurrent(core.items);
 if (!bookmark) {
  core.items.push({ type: 'file', ctime: now(), path, title: CURRENT_READING_BOOKMARK });
  return true;
 }
 let changed = bookmark.path !== path;
 bookmark.path = path;
 // A file-only bookmark contains no heading, block, cursor, or scroll state.
 for (const field of ['subpath', 'scrollPercent', 'viewState', 'state']) {
  if (Object.prototype.hasOwnProperty.call(bookmark, field)) { delete bookmark[field]; changed = true; }
 }
 return changed;
}
export type BookmarkSyncResult = 'updated' | 'unchanged' | 'unavailable' | 'missing' | 'empty' | 'stopped';
export class CurrentReadingBookmark {
 private queue: Promise<unknown> = Promise.resolve();
 private stopped = false;
 private unsaved = false;
 constructor(private state: PositionStore, private resolve: () => CoreBookmarks | null, private exists: (path: string) => boolean, private resolvePath?: (position: Position) => Promise<string | null>) {}
 sync(): Promise<BookmarkSyncResult> {
  const task = this.queue.then(async (): Promise<BookmarkSyncResult> => {
   if (this.stopped) return 'stopped';
   if (this.state.blocked || this.state.pending || !this.state.position) return 'empty';
   const position = this.state.position;
   const path = this.resolvePath ? await this.resolvePath(position) : chapterPath(position);
   if (this.stopped) return 'stopped';
   if (this.state.position !== position || this.state.pending || this.state.blocked) return 'empty';
   if (!path || !this.exists(path)) return 'missing';
   const core = this.resolve();
   if (!core) return 'unavailable';
   const changed = updateCurrentBookmark(core, path);
   if (!changed && !this.unsaved) return 'unchanged';
   this.unsaved = true;
   await core.onItemsChanged(true);
   this.unsaved = false;
   return 'updated';
  });
  this.queue = task.catch(() => {});
  return task;
 }
 stop(): void { this.stopped = true; }
}

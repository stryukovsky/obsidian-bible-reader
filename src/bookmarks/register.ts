import { Notice, TFile, type Plugin } from 'obsidian';
import type { ReaderController } from '../reader/controller';
import { sameChapter } from '../state/history';
import { chapterPath, positionFromPath } from '../reader/markdown';
import { errorMessage } from '../types';
import { coreBookmarks, CurrentReadingBookmark } from './current-reading';

export function registerCurrentReadingBookmark(plugin: Plugin, reader: ReaderController): CurrentReadingBookmark {
 const bookmark = new CurrentReadingBookmark(reader.state, () => coreBookmarks(plugin.app), path => plugin.app.vault.getAbstractFileByPath(path) instanceof TFile, async position => {
  const resolved = await reader.resolveChapter(position);
  return resolved ? chapterPath(resolved) : null;
 });
 let lastError = '';
 const sync = (): void => {
  void bookmark.sync().then(() => { lastError = ''; }).catch((error: unknown) => {
   const message = errorMessage(error);
   if (message !== lastError) new Notice(`Could not update the Bible bookmark: ${message}`);
   lastError = message;
  });
 };
 plugin.register(() => bookmark.stop());
 plugin.register(reader.state.subscribe(() => {
  if (!reader.state.pending && !reader.state.blocked) sync();
 }));
 plugin.app.workspace.onLayoutReady(() => { void reader.state.load().then(sync); });
 plugin.registerEvent(plugin.app.vault.on('create', file => {
  const position = reader.state.position;
  if (position && (file.path === chapterPath(position) || sameChapter(positionFromPath(file.path), position))) sync();
 }));
 plugin.addCommand({
  id: 'sync-current-reading-bookmark', name: 'Update current reading bookmark',
  callback: async () => {
   try {
    await reader.state.load();
    const result = await bookmark.sync();
    if (result === 'unavailable') new Notice('Enable Bookmarks in Settings → Core plugins, then retry. If it is already enabled, this version of its bookmark API is unsupported.');
    else if (result === 'missing') new Notice('The current Bible chapter is missing. Sync or import its Markdown file first.');
    else if (result === 'empty') new Notice(reader.state.issue || 'Open a Bible chapter before creating its bookmark.');
    else if (result !== 'stopped') new Notice('Current Bible reading bookmark is up to date.');
   } catch (error) { new Notice(errorMessage(error)); }
  },
 });
 return bookmark;
}

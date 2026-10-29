import { Notice, type Plugin } from 'obsidian';
import { STATE_PATH } from '../library/storage';
import { errorMessage } from '../types';
import type { ReaderController } from './controller';

export function registerReaderEvents(plugin: Plugin, reader: ReaderController): void {
 let ready = false;
 let active = true;
 plugin.register(() => { active = false; });
 // Workspace restoration must not replace a newer synced reading reference.
 plugin.app.workspace.onLayoutReady(() => { if (active) ready = true; });
 const changed = (file: { path: string }): void => {
  if (file.path === STATE_PATH) void reader.state.externalChange();
 };
 plugin.registerEvent(plugin.app.vault.on('create', changed));
 plugin.registerEvent(plugin.app.vault.on('modify', changed));
 plugin.registerEvent(plugin.app.vault.on('delete', changed));
 plugin.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
  if (file.path === STATE_PATH || oldPath === STATE_PATH) void reader.state.externalChange();
 }));
 plugin.registerEvent(plugin.app.workspace.on('file-open', file => {
  if (!ready || !active) return;
  void reader.fileOpened(file?.path ?? null).catch((error: unknown) => {
   new Notice(`Reading position was not saved: ${errorMessage(error)} Use the Recover reading position command.`);
  });
 }));
}

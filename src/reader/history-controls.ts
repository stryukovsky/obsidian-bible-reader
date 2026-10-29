import { Notice, type Plugin } from 'obsidian';
import { errorMessage } from '../types';
import type { ReaderController } from './controller';

export function registerHistoryControls(plugin: Plugin, reader: ReaderController): void {
 const jump = (step: -1 | 1): void => {
  void reader.moveHistory(step).catch((error: unknown) => { new Notice(errorMessage(error)); });
 };
 const back = plugin.addRibbonIcon('chevron-left', 'Previous Bible position', () => { if (reader.state.canGoBack) jump(-1); });
 const forward = plugin.addRibbonIcon('chevron-right', 'Next Bible position', () => { if (reader.state.canGoForward) jump(1); });
 const update = (): void => {
  for (const [button, enabled] of [[back, reader.state.canGoBack], [forward, reader.state.canGoForward]] as const) {
   button.setAttribute('aria-disabled', String(!enabled));
   button.classList.toggle('bible-history-disabled', !enabled);
  }
 };
 update();
 plugin.register(reader.state.subscribe(update));
 plugin.app.workspace.onLayoutReady(() => { void reader.state.load(); });
 plugin.addCommand({ id: 'previous-reading-position', name: 'Previous reading position', callback: () => jump(-1) });
 plugin.addCommand({ id: 'next-reading-position', name: 'Next reading position', callback: () => jump(1) });
}

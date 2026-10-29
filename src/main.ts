import { Notice, Plugin, TFile } from 'obsidian';
import { registerCurrentReadingBookmark } from './bookmarks/register';
import { errorMessage } from './types';
import { VaultStorage } from './library/vault-storage';
import { ReaderController } from './reader/controller';
import { InstallModal } from './reader/install-modal';
import { PositionRecoveryModal } from './reader/recovery-modal';
import { registerScrollTracking, type ScrollTracker } from './reader/scroll';
import { registerHistoryControls } from './reader/history-controls';
import { registerReaderEvents } from './reader/register-events';

export default class BibleReaderPlugin extends Plugin {
 reader!: ReaderController;
 onload(): void {
  let scroll: ScrollTracker | undefined;
  this.reader = new ReaderController(new VaultStorage(this.app.vault), async path => {
   const file = this.app.vault.getAbstractFileByPath(path);
   if (!(file instanceof TFile)) throw new Error(`Bible chapter is missing: ${path}.`);
   await this.app.workspace.getLeaf(false).openFile(file);
  }, (path, percent) => scroll?.restore(path, percent) ?? Promise.resolve());
  scroll = registerScrollTracking(this, this.reader);
  this.register(() => this.reader.stop());
  const resume = (): void => { void this.openReader(); };
  this.addRibbonIcon('book-open', 'Open Bible reader', resume);
  this.addCommand({ id: 'open-bible-reader', name: 'Open reader', callback: resume });
  this.addCommand({ id: 'install-bible-translation', name: 'Install translation', callback: () => new InstallModal(this.app, this.reader).open() });
  this.addCommand({ id: 'recover-reading-position', name: 'Recover reading position', callback: () => new PositionRecoveryModal(this.app, this.reader).open() });
  registerCurrentReadingBookmark(this, this.reader);
  registerHistoryControls(this, this.reader);
  registerReaderEvents(this, this.reader);
 }
 private async openReader(): Promise<void> {
  try {
   if (!await this.reader.openSaved()) new InstallModal(this.app, this.reader).open();
  } catch (error) {
   if (this.reader.state.blocked) new PositionRecoveryModal(this.app, this.reader).open();
   else new Notice(errorMessage(error));
  }
 }
}

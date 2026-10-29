import { App, Modal, Notice, Setting } from 'obsidian';
import { errorMessage } from '../types';
import type { ReaderController } from './controller';

export class PositionRecoveryModal extends Modal {
 constructor(app: App, private reader: ReaderController) { super(app); }
 onOpen(): void {
  this.setTitle('Recover Bible reading position');
  this.contentEl.createEl('p', { text: this.reader.state.issue || 'Choose the saved position or the chapter most recently opened on this device.' });
  new Setting(this.contentEl).setName('Use synced position').setDesc('Reload state.json without changing it.').addButton(button => button.setButtonText('Open saved chapter').onClick(() => {
   void this.run(async () => { await this.reader.state.useIncoming(); await this.reader.openSaved(); });
  }));
  const local = this.reader.localPosition ?? this.reader.state.position;
  if (local) new Setting(this.contentEl).setName(`Keep ${local.translationId} ${local.bookId} ${local.chapter}`).setDesc('Back up the current state file before saving this reference.').addButton(button => button.setButtonText('Keep local chapter').onClick(() => {
   void this.run(async () => { await this.reader.state.keepLocal(local); await this.reader.openSaved(); });
  }));
 }
 private async run(action: () => Promise<void>): Promise<void> {
  try { await action(); this.close(); }
  catch (error) { new Notice(errorMessage(error)); }
 }
 onClose(): void { this.contentEl.empty(); }
}

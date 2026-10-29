import { App, Modal, Notice, Setting, requestUrl } from 'obsidian';
import { MAX_ARCHIVE } from '../sword/archive';
import { errorMessage } from '../types';
import type { ReaderController } from './controller';

export const KJV_URL = 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/KJV.zip';

export class InstallModal extends Modal {
 private busy = false;
 private closed = false;
 private status!: HTMLElement;
 constructor(app: App, private reader: ReaderController) { super(app); }
 onOpen(): void {
  this.setTitle('Install a Bible translation');
  const content = this.contentEl;
  content.createEl('p', { text: 'Import a native SWORD module ZIP, or download the King James Version from CrossWire. Each chapter is converted to a normal Markdown note under Bible/translation/book/chapter.md.' });
  content.createEl('p', { text: 'Supported: unlocked zText (ZIP compression) and RawText, including Synodal and other standard SWORD versifications. Maximum archive: 32 MiB.' });
  new Setting(content).setName('Import SWORD ZIP').setDesc('Choose a module file from your device. No network request is made.').addButton(button => button.setButtonText('Choose ZIP').onClick(() => {
   const input = content.createEl('input', { type: 'file', cls: 'bible-reader-file-input' });
   input.accept = '.zip,application/zip';
   input.onchange = () => {
    const file = input.files?.[0];
    if (file) void this.run(async () => {
     if (file.size > MAX_ARCHIVE) throw new Error('ZIP exceeds the 32 MiB limit.');
     return new Uint8Array(await file.arrayBuffer());
    });
    input.remove();
   };
   input.click();
  }));
  new Setting(content).setName('Convert previously installed modules').setDesc('Generate chapter notes from modules installed by an earlier version. Edited notes are preserved.').addButton(button => button.setButtonText('Convert installed modules').onClick(() => {
   if (this.busy) return;
   this.busy = true;
   this.status.setText('Converting installed modules to Markdown…');
   void this.reader.library.convertInstalled().then(() => {
    if (!this.closed) this.status.setText('Markdown conversion complete. Select the Bible ribbon button to open your saved chapter.');
   }).catch((error: unknown) => {
    if (!this.closed) this.status.setText(errorMessage(error));
   }).finally(() => { this.busy = false; });
  }));
  content.createEl('h3', { text: 'King James Version' });
  content.createEl('p', { text: 'CrossWire KJV with Strong’s metadata, approximately 4 MiB. This reader displays the Bible text; study annotations are not yet shown.' });
  content.createEl('p', { text: 'Module license: GPL, with additional permissions and notices in its About metadata. KJV base-text rights are held by the Crown in the United Kingdom. Review the source terms before redistributing.' });
  content.createEl('p', { text: `Source: ${KJV_URL}` });
  content.createEl('p', { text: 'Selecting Download contacts crosswire.org and sends ordinary connection metadata, including your IP address. No vault content or reading position is sent.' });
  new Setting(content).setName('Download into this vault').addButton(button => button.setButtonText('Download KJV').setCta().onClick(() => {
   void this.run(async () => {
    const response = await requestUrl({ url: KJV_URL, method: 'GET', throw: true });
    if (response.arrayBuffer.byteLength > MAX_ARCHIVE) throw new Error('Download exceeds the 32 MiB limit.');
    return new Uint8Array(response.arrayBuffer);
   });
  }));
  this.status = content.createEl('p', { attr: { role: 'status', 'aria-live': 'polite' } });
 }
 private async run(load: () => Promise<Uint8Array>): Promise<void> {
  if (this.busy || this.closed) return;
  this.busy = true;
  this.status.setText('Validating and converting module to Markdown…');
  try {
   const id = await this.reader.library.install(await load());
   if (!this.closed) this.status.setText(`${id} converted to Markdown. Select the Bible ribbon button to open your saved chapter.`);
   new Notice(`${id} installed`);
  } catch (error) {
   if (!this.closed) this.status.setText(`Installation failed: ${errorMessage(error)}`);
  } finally { this.busy = false; }
 }
 onClose(): void { this.closed = true; this.contentEl.empty(); }
}

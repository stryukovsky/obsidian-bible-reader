import { LIBRARY, type Storage } from './storage';
import { parseConfig } from '../sword/config';
import { openArchive } from '../sword/archive';
import { SwordModule } from '../sword/module';
import { errorMessage } from '../types';
import { convertToMarkdown, writeMarkdown } from '../reader/markdown';

export interface InstalledModule {
 module: SwordModule;
 root: string;
}
export class TranslationLibrary {
 modules: InstalledModule[] = [];
 warnings: string[] = [];
 private refreshTask?: Promise<void>;
 private installing = false;
 private stopped = false;
 stop(): void { this.stopped = true; }
 constructor(private storage: Storage) {}

 refresh(): Promise<void> {
  if (!this.refreshTask) this.refreshTask = this.discover().finally(() => { this.refreshTask = undefined; });
  return this.refreshTask;
 }
 private async discover(): Promise<void> {
  const found = new Map<string, InstalledModule>();
  const warnings: string[] = [];
  const { folders } = await this.storage.list(LIBRARY);
  for (const idRoot of folders) {
   const revisions = await this.storage.list(idRoot);
   for (const root of revisions.folders.sort()) {
    try {
     const ready = await this.storage.read(`${root}/ready.json`);
     if (!ready) continue; // Interrupted staging is intentionally never activated.
     const record: unknown = JSON.parse(ready);
     if (!record || typeof record !== 'object' || !('schemaVersion' in record) || record.schemaVersion !== 1 || !('configPath' in record) || typeof record.configPath !== 'string' || !/^mods\.d\/[A-Za-z0-9_.-]+\.conf$/.test(record.configPath)) {
      throw new Error('Invalid installation record.');
     }
     const text = await this.storage.read(`${root}/${record.configPath}`);
     if (!text) throw new Error('Missing module configuration.');
     const config = parseConfig(text);
     if (idRoot !== `${LIBRARY}/${config.id}`) throw new Error('Module identity does not match installation folder.');
     const module = new SwordModule(config, path => this.storage.readBinary(`${root}/${path}`));
     await module.initialize();
     const previous = found.get(config.id);
     if (!previous || config.version.localeCompare(previous.module.config.version, 'en', { numeric: true }) >= 0) found.set(config.id, { module, root });
    } catch (error) { warnings.push(`${root}: ${errorMessage(error)}`); }
   }
  }
  this.modules = [...found.values()].sort((a, b) => a.module.config.title.localeCompare(b.module.config.title));
  this.warnings = warnings;
 }

 async convertInstalled(): Promise<void> {
  if (this.stopped || this.installing) throw new Error('The reader is unloaded or an installation is already running.');
  this.installing = true;
  try {
   await this.refresh();
   for (const { module } of this.modules) {
    await writeMarkdown(this.storage, await convertToMarkdown(module), () => this.stopped);
   }
  } finally { this.installing = false; }
 }

 async install(bytes: Uint8Array): Promise<string> {
  if (this.stopped) throw new Error('The reader has been unloaded. Re-enable the plugin before installing.');
  if (this.installing) throw new Error('Another translation installation is in progress.');
  this.installing = true;
  try {
   const archive = await openArchive(bytes);
   const module = new SwordModule(archive.config, async path => {
    const bytes = archive.files[path];
    if (!bytes) throw new Error(`Missing module file: ${path}.`);
    return bytes;
   });
   await module.initialize();
   const chapters = await convertToMarkdown(module);
   await writeMarkdown(this.storage, chapters, () => this.stopped);
   const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer));
   const revision = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
   const root = `${LIBRARY}/${archive.config.id}/${revision}`;
   if (!await this.storage.read(`${root}/ready.json`)) {
    for (const [path, data] of Object.entries(archive.files)) {
     if (this.stopped) throw new Error('Installation cancelled because the plugin was unloaded.');
     await this.storage.writeBinary(`${root}/${path}`, data);
    }
    if (this.stopped) throw new Error('Installation cancelled because the plugin was unloaded.');
    await this.storage.write(`${root}/ready.json`, JSON.stringify({ schemaVersion: 1, configPath: archive.configPath, sha256: revision }, null, 2) + '\n');
   }
   await this.refresh();
   if (!this.modules.some(item => item.module.config.id === archive.config.id)) throw new Error('Module was written but could not be opened. Select refresh to inspect the library.');
   return archive.config.id;
  } finally { this.installing = false; }
 }
}

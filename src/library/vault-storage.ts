import { TFile, type Vault } from 'obsidian';
import type { Storage } from './storage';

export class VaultStorage implements Storage {
 constructor(private vault: Vault) {}
 async read(path: string): Promise<string | null> {
  if (!await this.vault.adapter.exists(path)) return null;
  return this.vault.adapter.read(path);
 }
 async readBinary(path: string): Promise<Uint8Array> {
  return new Uint8Array(await this.vault.adapter.readBinary(path));
 }
 private async parents(path: string): Promise<void> {
  const parts = path.split('/');
  parts.pop();
  let folder = '';
  for (const part of parts) {
   folder = folder ? `${folder}/${part}` : part;
   if (!await this.vault.adapter.exists(folder)) {
    try { await this.vault.createFolder(folder); }
    catch (error) { if (!await this.vault.adapter.exists(folder)) throw error; }
   }
  }
 }
 async create(path: string, text: string): Promise<void> {
  await this.parents(path);
  await this.vault.create(path, text);
 }
 async write(path: string, text: string): Promise<void> {
  await this.parents(path);
  const file = this.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) await this.vault.modify(file, text);
  else await this.vault.create(path, text);
 }
 async writeBinary(path: string, bytes: Uint8Array): Promise<void> {
  await this.parents(path);
  const buffer = new Uint8Array(bytes).buffer;
  const file = this.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) await this.vault.modifyBinary(file, buffer);
  else await this.vault.createBinary(path, buffer);
 }
 async list(path: string): Promise<{ files: string[]; folders: string[] }> {
  return await this.vault.adapter.exists(path) ? this.vault.adapter.list(path) : { files: [], folders: [] };
 }
}

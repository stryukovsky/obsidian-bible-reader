import { unzipSync } from 'fflate';
import { parseConfig, safePath, type SwordConfig } from './config';
import { SwordModule } from './module';
import { zipDirectory } from './zip-directory';
import { crc32 } from './checksum';

export const MAX_ARCHIVE = 32 * 1024 * 1024;
export const MAX_EXPANDED = 64 * 1024 * 1024;
export interface ModuleArchive {
 config: SwordConfig;
 files: Record<string, Uint8Array>;
 configPath: string;
}

export async function openArchive(bytes: Uint8Array): Promise<ModuleArchive> {
 if (bytes.length > MAX_ARCHIVE) throw new Error('Module ZIP exceeds the 32 MiB download/import limit.');
 const directory = zipDirectory(bytes);
 let total = 0;
 let count = 0;
 const names = new Set<string>();
 const files = unzipSync(bytes, { filter: file => {
  const path = safePath(file.name);
  if (names.has(path)) throw new Error('Duplicate archive path.');
  names.add(path);
  if (++count > 100 || file.originalSize > MAX_EXPANDED || (total += file.originalSize) > MAX_EXPANDED) {
   throw new Error('Module archive exceeds file or expansion limits.');
  }
  return !file.name.endsWith('/');
 } });
 for (const [path, data] of Object.entries(files)) {
  const entry = directory.get(path);
  if (!entry || entry.size !== data.length || entry.crc !== crc32(data)) throw new Error('ZIP entry checksum or size mismatch.');
 }
 const configs = Object.keys(files).filter(path => /^mods\.d\/[A-Za-z0-9_.-]+\.conf$/i.test(path));
 const configPath = configs[0];
 if (configs.length !== 1 || !configPath) throw new Error('Import a native SWORD ZIP containing one mods.d/*.conf file.');
 const config = parseConfig(new TextDecoder().decode(files[configPath]));
 const selected: Record<string, Uint8Array> = {};
 for (const [path, data] of Object.entries(files)) {
  if (path === configPath || path.startsWith(`${config.dataPath}/`)) selected[path] = data;
  else throw new Error(`Unexpected file outside module data: ${path}.`);
 }
 const module = new SwordModule(config, async path => {
  const data = selected[path];
  if (!data) throw new Error(`Missing module file: ${path}.`);
  return data;
 });
 await module.initialize();
 // Check at least one actual compressed block before exposing an installation.
 const book = module.books[0];
 if (book) await module.chapter(book.id, module.availableChapters(book)[0] ?? 1);
 return { config, configPath, files: selected };
}

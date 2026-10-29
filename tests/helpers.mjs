export class MemoryStorage {
 files = new Map();
 writes = [];
 failWrite = false;
 async read(path) { const value=this.files.get(path); return value instanceof Uint8Array ? new TextDecoder().decode(value) : value ?? null; }
 async readBinary(path) {
  const value = this.files.get(path);
  if (value === undefined) throw new Error('Missing file');
  return typeof value === 'string' ? new TextEncoder().encode(value) : value;
 }
 async create(path, text) {
  if (this.files.has(path)) throw new Error('File already exists');
  await this.write(path, text);
 }
 async write(path, text) {
  if (this.failWrite) throw new Error('Disk full');
  this.writes.push(path);
  this.files.set(path, text);
 }
 async writeBinary(path, bytes) {
  if (this.failWrite) throw new Error('Disk full');
  this.files.set(path, bytes);
 }
 async list(path) {
  const files = [];
  const folders = new Set();
  for (const file of this.files.keys()) {
   if (!file.startsWith(path + '/')) continue;
   const rest = file.slice(path.length + 1);
   if (rest.includes('/')) folders.add(path + '/' + rest.split('/')[0]);
   else files.push(file);
  }
  return { files, folders: [...folders] };
 }
}
export const configText = '[Test]\nModDrv=RawText\nDataPath=./modules/texts/rawtext/test/\nEncoding=UTF-8\nVersification=KJV\nDescription=Test Bible\nDistributionLicense=Public Domain\nSourceType=Plain\n';
export function rawFiles(book, verseIndex) {
 const index = new Uint8Array((verseIndex(book, 1, 3) + 1) * 6);
 const view = new DataView(index.buffer);
 const first = new TextEncoder().encode('First verse.');
 const second = new TextEncoder().encode('Second verse.');
 for (const [verse, start, size] of [[1,0,first.length],[2,first.length,second.length]]) {
  const offset = verseIndex(book,1,verse)*6;
  view.setUint32(offset,start,true);view.setUint16(offset+4,size,true);
 }
 const data = new Uint8Array(first.length+second.length);data.set(first);data.set(second,first.length);
 return {'mods.d/test.conf':new TextEncoder().encode(configText),'modules/texts/rawtext/test/ot.vss':index,'modules/texts/rawtext/test/ot':data};
}

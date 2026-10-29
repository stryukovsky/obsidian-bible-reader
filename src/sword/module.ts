import { unzlibSync } from 'fflate';
import { validZlibChecksum } from './checksum';
import { getCanon, verseIndex, type BibleBook } from './canon';
import type { SwordConfig } from './config';
import type { Verse } from '../types';

export const MAX_BLOCK = 16 * 1024 * 1024;
export type ReadBinary = (path: string) => Promise<Uint8Array>;
interface Testament {
 index: DataView;
 blocks?: DataView;
 dataPath: string;
 dataLength: number;
}

function view(bytes: Uint8Array): DataView {
 return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export class SwordModule {
 readonly books: BibleBook[] = [];
 private testaments = new Map<string, Testament>();
 private cache = new Map<string, Uint8Array>();
 constructor(readonly config: SwordConfig, private read: ReadBinary) {}

 async initialize(): Promise<void> {
  for (const testament of ['ot', 'nt'] as const) {
   const prefix = `${this.config.dataPath}/${testament}`;
   const compressed = this.config.driver === 'zText';
   const indexPath = compressed ? `${prefix}.${this.config.block}zv` : `${prefix}.vss`;
   let bytes: Uint8Array;
   try { bytes = await this.read(indexPath); } catch { continue; }
   if (!bytes.length) continue;
   const width = compressed ? 10 : 6;
   if (bytes.length % width) throw new Error(`Invalid ${testament} verse index.`);
   const dataPath = compressed ? `${prefix}.${this.config.block}zz` : prefix;
   const data = await this.read(dataPath);
   const blocks = compressed ? view(await this.read(`${prefix}.${this.config.block}zs`)) : undefined;
   if (blocks && blocks.byteLength % 12) throw new Error('Invalid SWORD block index.');
   const entry = { index: view(bytes), blocks, dataPath, dataLength: data.length };
   this.testaments.set(testament, entry);
   for (let offset = 0; offset < bytes.length; offset += width) {
    if (compressed) {
     const size = entry.index.getUint16(offset + 8, true);
     if (!size) continue;
     const block = entry.index.getUint32(offset, true) * 12;
     if (!blocks || block + 12 > blocks.byteLength) throw new Error('Verse references an absent block.');
     const start = blocks.getUint32(block, true);
     const length = blocks.getUint32(block + 4, true);
     const expanded = blocks.getUint32(block + 8, true);
     if (expanded > MAX_BLOCK || start + length > data.length || entry.index.getUint32(offset + 4, true) + size > expanded) {
      throw new Error('SWORD block exceeds data or safety limits.');
     }
    } else if (entry.index.getUint32(offset, true) + entry.index.getUint16(offset + 4, true) > data.length) {
     throw new Error('RawText verse exceeds data.');
    }
   }
  }
  for (const book of getCanon(this.config.versification)) {
   if (this.availableChapters(book).length) this.books.push(book);
  }
  if (!this.books.length) throw new Error('Module has no readable Bible chapters.');
 }

 availableChapters(book: BibleBook): number[] {
  const testament = this.testaments.get(book.testament);
  if (!testament) return [];
  return book.verses.flatMap((count, index) => {
   const chapter = index + 1;
   for (let verse = 1; verse <= count; verse++) {
    if (this.entrySize(testament, verseIndex(book, chapter, verse, getCanon(this.config.versification)))) return [chapter];
   }
   return [];
  });
 }

 private entrySize(testament: Testament, index: number): number {
  const compressed = this.config.driver === 'zText';
  const offset = index * (compressed ? 10 : 6);
  const sizeAt = offset + (compressed ? 8 : 4);
  return sizeAt + 2 <= testament.index.byteLength ? testament.index.getUint16(sizeAt, true) : 0;
 }

 async chapter(bookId: string, chapter: number): Promise<Verse[]> {
  const book = this.books.find(item => item.id === bookId);
  if (!book || !this.availableChapters(book).includes(chapter)) throw new Error('This module does not contain that chapter.');
  const testament = this.testaments.get(book.testament);
  if (!testament) throw new Error('Missing testament.');
  const verses: Verse[] = [];
  for (let number = 1; number <= (book.verses[chapter - 1] ?? 0); number++) {
   const index = verseIndex(book, chapter, number, getCanon(this.config.versification));
   const size = this.entrySize(testament, index);
   if (!size) continue;
   const offset = index * (this.config.driver === 'zText' ? 10 : 6);
   let start = testament.index.getUint32(offset, true);
   let data: Uint8Array;
   if (this.config.driver === 'zText') {
    const blockId = start;
    start = testament.index.getUint32(offset + 4, true);
    data = await this.block(book.testament, testament, blockId);
   } else {
    data = await this.cached(testament.dataPath, () => this.read(testament.dataPath));
   }
   const text = new TextDecoder(this.config.encoding === 'UTF-8' ? 'utf-8' : 'windows-1252').decode(data.subarray(start, start + size)).replace(/\0+$/, '');
   verses.push({ number, text });
  }
  return verses;
 }

 private async block(testamentId: string, testament: Testament, id: number): Promise<Uint8Array> {
  return this.cached(`${testamentId}:${id}`, async () => {
   const blocks = testament.blocks;
   if (!blocks) throw new Error('Missing block index.');
   const at = id * 12;
   const offset = blocks.getUint32(at, true);
   const length = blocks.getUint32(at + 4, true);
   const expected = blocks.getUint32(at + 8, true);
   const data = await this.read(testament.dataPath);
   const packed = data.subarray(offset, offset + length);
   // zlib's trailer declares the expanded checksum; bounded output avoids allocating from untrusted sizes.
   const result = unzlibSync(packed, { out: new Uint8Array(expected) });
   if (packed.length < 6 || result.length !== expected || !validZlibChecksum(packed, result)) throw new Error('SWORD block checksum or length mismatch.');
   return result;
  });
 }

 private async cached(key: string, load: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const existing = this.cache.get(key);
  if (existing) { this.cache.delete(key); this.cache.set(key, existing); return existing; }
  const data = await load();
  this.cache.set(key, data);
  while (this.cache.size > 2) {
   const oldest = this.cache.keys().next().value;
   if (oldest !== undefined) this.cache.delete(oldest);
  }
  return data;
 }
}

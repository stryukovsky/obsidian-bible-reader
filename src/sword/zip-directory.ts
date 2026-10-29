import { safePath } from './config';
export interface ZipEntry { crc: number; size: number }
export function zipDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 let end = bytes.length - 22;
 const minimum = Math.max(0, bytes.length - 65557);
 while (end >= minimum) {
  if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
  end--;
 }
 if (end < minimum) throw new Error('Invalid ZIP directory.');
 if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Multi-disk archives are not supported.');
 const count = view.getUint16(end + 10, true);
 if (count > 100 || count !== view.getUint16(end + 8, true)) throw new Error('Archive exceeds entry limits or uses unsupported ZIP64.');
 let at = view.getUint32(end + 16, true);
 const directoryEnd = at + view.getUint32(end + 12, true);
 if (directoryEnd !== end) throw new Error('Invalid ZIP directory bounds.');
 const entries = new Map<string, ZipEntry>();
 let total = 0;
 for (let i = 0; i < count; i++) {
  if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw new Error('Invalid ZIP entry.');
  const nameLength = view.getUint16(at + 28, true);
  const next = at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  if (next > end) throw new Error('Invalid ZIP entry bounds.');
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
  safePath(name);
  if (entries.has(name)) throw new Error('Duplicate archive path.');
  if (view.getUint16(at + 8, true) & 1) throw new Error('Encrypted ZIP entries are not supported.');
  const size = view.getUint32(at + 24, true);
  total += size;
  if (total > 64 * 1024 * 1024) throw new Error('Archive exceeds expansion limits.');
  entries.set(name, { size, crc: view.getUint32(at + 16, true) });
  at = next;
 }
 if (at !== directoryEnd) throw new Error('Invalid ZIP directory size.');
 return entries;
}

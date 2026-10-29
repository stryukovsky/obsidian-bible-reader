// RFC 1950 Adler-32 checksum, used by SWORD's zlib-compressed blocks.
export function adler32(bytes: Uint8Array): number {
 let a = 1;
 let b = 0;
 for (let at = 0; at < bytes.length; at++) {
  a = (a + (bytes[at] ?? 0)) % 65521;
  b = (b + a) % 65521;
 }
 return ((b << 16) | a) >>> 0;
}

// Some SWORD writers append zero-filled spare capacity after the zlib stream.
export function validZlibChecksum(packed: Uint8Array, result: Uint8Array): boolean {
 const expected = adler32(result);
 let end = packed.length;
 while (end > 0 && packed[end - 1] === 0) end--;
 const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
 for (let zeros = 0; zeros < 4; zeros++) {
  const checksumEnd = end + zeros;
  if (checksumEnd >= 6 && checksumEnd <= packed.length && view.getUint32(checksumEnd - 4, false) === expected) return true;
 }
 return false;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
 let crc = value;
 for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
 return crc >>> 0;
});
export function crc32(bytes: Uint8Array): number {
 let crc = 0xffffffff;
 for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 255] ?? 0) ^ (crc >>> 8);
 return (crc ^ 0xffffffff) >>> 0;
}

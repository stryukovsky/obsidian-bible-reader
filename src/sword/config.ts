import { getCanon } from './canon';
export interface SwordConfig {
 id: string;
 versification: string;
 title: string;
 dataPath: string;
 driver: 'zText' | 'RawText';
 block: string;
 encoding: string;
 sourceType: string;
 language: string;
 version: string;
 license: string;
 about: string;
 source: string;
 direction: string;
}

export function safePath(path: string): string {
 const clean = path.replace(/^\.\//, '').replace(/\/$/, '');
 if (!clean || clean.startsWith('/') || (/[\\:]/.test(clean) || Array.from(clean).some(char => char.charCodeAt(0) < 32)) ||
  clean.split('/').some(part => !part || part === '.' || part === '..')) {
  throw new Error('Unsafe module path.');
 }
 return clean;
}

export function parseConfig(text: string): SwordConfig {
 const fields: Record<string, string> = {};
 let id = '';
 for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const value = line.trim();
  if (!value || /^[#;]/.test(value)) continue;
  const section = /^\[([A-Za-z0-9_]+)\]$/.exec(value);
  if (section) {
   if (id) throw new Error('Expected one module per configuration.');
   id = section[1] ?? '';
  } else {
   const at = value.indexOf('=');
   if (at > 0) fields[value.slice(0, at)] = value.slice(at + 1);
  }
 }
 if (!id) throw new Error('Missing SWORD module identifier.');
 const driver = fields.ModDrv;
 if (driver !== 'zText' && driver !== 'RawText') throw new Error(`Unsupported SWORD driver: ${driver ?? 'missing'}. Use zText or RawText.`);
 if ('CipherKey' in fields) throw new Error('Locked SWORD modules are not supported.');
 const versification = fields.Versification ?? 'KJV';
 getCanon(versification);
 if (driver === 'zText' && (fields.CompressType ?? 'LZSS').toUpperCase() !== 'ZIP') throw new Error('Only ZIP-compressed zText modules are supported.');
 const block = ({ BOOK: 'b', CHAPTER: 'c', VERSE: 'v' } as Record<string, string>)[(fields.BlockType ?? 'CHAPTER').toUpperCase()];
 if (driver === 'zText' && !block) throw new Error('Unsupported SWORD block type.');
 const encoding = (fields.Encoding ?? 'Latin-1').toUpperCase();
 if (!['UTF-8', 'LATIN-1'].includes(encoding)) throw new Error(`Unsupported encoding: ${encoding}.`);
 const sourceType = fields.SourceType ?? 'Plain';
 if (!['OSIS', 'ThML', 'GBF', 'Plain'].includes(sourceType)) throw new Error(`Unsupported markup: ${sourceType}.`);
 const dataPath = safePath(fields.DataPath ?? '');
 if (!dataPath.startsWith('modules/texts/')) throw new Error('Expected a SWORD Bible text data path.');
 return {
  id, versification, driver, block: block ?? '', dataPath, encoding, sourceType,
  title: fields.Description ?? id, language: fields.Lang ?? 'und',
  version: fields.Version ?? '', license: fields.DistributionLicense ?? 'Not specified; consult the source.',
  about: fields.About ?? '', source: fields.TextSource ?? '', direction: fields.Direction === 'RtoL' ? 'rtl' : 'ltr',
 };
}

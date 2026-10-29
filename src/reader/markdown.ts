import { BOOK_REGISTRY } from '../sword/canon';
import type { SwordModule } from '../sword/module';
import type { Storage } from '../library/storage';
import type { Position } from '../types';
import { chapterPositions } from './navigation';
import { verseText } from './text';

export { BIBLE_ROOT, chapterPath, positionFromPath } from './paths';
import { BIBLE_ROOT, chapterPath, positionFromMarkdown } from './paths';

// Text becomes literal Markdown content, never source-provided links or HTML.
export function markdownText(text: string): string {
 return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/([\\`*_{}[\]()#+.!|~^$=-])/g, '\\$1').replace(/\r?\n/g, ' ');
}

function link(position: Position | undefined, label: string): string {
 return position ? `[[${chapterPath(position).slice(0, -3)}|${label}]]` : '';
}

export async function convertToMarkdown(module: SwordModule): Promise<Map<string, string>> {
 const files = new Map<string, string>();
 const positions = chapterPositions(module);
 for (let index = 0; index < positions.length; index++) {
  const position = positions[index];
  if (!position) continue;
  const book = BOOK_REGISTRY.find(book => book.id === position.bookId);
  const verses = await module.chapter(position.bookId, position.chapter);
  const navigation = [link(positions[index - 1], 'Previous chapter'), link(positions[index + 1], 'Next chapter')].filter(Boolean).join(' · ');
  const header = `---\nbible-translation: ${position.translationId}\nbible-book: ${position.bookId}\nbible-chapter: ${position.chapter}\n---\n\n# ${book?.name ?? position.bookId} ${position.chapter}\n`;
  const text = verses.map(verse => `**${verse.number}** ${markdownText(verseText(verse.text, module.config.sourceType))} ^v${verse.number}`).join('\n\n');
  const nextChapter = link(positions[index + 1], 'Next chapter');
  const footer = nextChapter ? `\n\n${nextChapter}` : '';
  files.set(chapterPath(position), `${header}\n${navigation}\n\n${text}${footer}\n`);
  // Let Obsidian process UI events between books during large imports.
  if (index > 0 && positions[index - 1]?.bookId !== position.bookId) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
 }
 const config = module.config;
 const metadata = [
  `# ${markdownText(config.id)}\n`,
  `Translation: ${markdownText(config.title)}`, `Version: ${markdownText(config.version)}`,
  `Language: ${markdownText(config.language)}`, `Versification: ${markdownText(config.versification ?? 'KJV')}`,
  `License: ${markdownText(config.license)}`, `Source: ${markdownText(config.source)}`,
  `## About\n\n${markdownText(config.about.replace(/\\par\s?/g, '\n'))}`,
 ].join('\n\n') + '\n';
 files.set(`${BIBLE_ROOT}/${config.id}/_translation.md`, metadata);
 return files;
}

export async function writeMarkdown(storage: Storage, files: Map<string, string>, stopped: () => boolean): Promise<void> {
 // Preflight the complete export before creating anything. Never replace user edits.
 for (const [path, text] of files) {
  if (stopped()) throw new Error('Conversion cancelled because the plugin was unloaded.');
  const current = await storage.read(path);
  if (current !== null && current !== text) throw new Error(`Chapter already exists with different content: ${path}. Move or back it up before importing this translation again.`);
 }
 for (const [path, text] of files) {
  if (stopped()) throw new Error('Conversion cancelled because the plugin was unloaded.');
  const current = await storage.read(path);
  if (current === text) continue;
  if (current !== null) throw new Error(`File changed during conversion; preserved ${path}.`);
  await storage.create(path, text);
 }
}

export async function firstChapter(storage: Storage): Promise<Position | null> {
 const translations = await storage.list(BIBLE_ROOT);
 for (const folder of translations.folders.sort()) {
  const id = folder.slice(BIBLE_ROOT.length + 1);
  if (!/^[A-Za-z0-9_]+$/.test(id)) continue;
  for (const book of BOOK_REGISTRY) {
   const chapters = await storage.list(`${folder}/${book.name}`);
   const available: Position[] = [];
   for (const path of chapters.files) {
    if (!path.endsWith('.md')) continue;
    const text = await storage.read(path);
    const position = text === null ? null : positionFromMarkdown(path, text);
    if (position) available.push(position);
   }
   available.sort((a, b) => a.chapter - b.chapter);
   if (available[0]) return available[0];
  }
 }
 return null;
}

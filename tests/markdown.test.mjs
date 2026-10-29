import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { MemoryStorage, rawFiles } from './helpers.mjs';
const {BOOKS,verseIndex,chapterPath,positionFromPath,convertToMarkdown,writeMarkdown,TranslationLibrary}=await import(process.env.BIBLE_TEST_BUNDLE);
const gen={translationId:'KJV',bookId:'Gen',chapter:1};

test('chapter paths use human-readable books and round-trip stable position IDs',()=>{
 assert.equal(chapterPath(gen),'Bible/KJV/Genesis/1.md');assert.deepEqual(positionFromPath(chapterPath(gen)),gen);
 for(const path of ['Bible/../Genesis/1.md','Bible/KJV/Genesis/0.md','Bible/KJV/Genesis/51.md','Other/KJV/Genesis/1.md','Bible/KJV/_translation.md','Bible/KJV/Genesis/01.md'])assert.equal(positionFromPath(path),null);
 assert.throws(()=>chapterPath({...gen,translationId:'../outside'}));
});

test('conversion produces normal notes with frontmatter, escaped verses, block IDs and chapter links',async()=>{
 const module={config:{id:'Test',title:'Test Bible',version:'1',language:'en',license:'Public Domain',source:'https://example.invalid',about:'Attribution'},books:BOOKS.slice(0,2),availableChapters:book=>book.id==='Gen'?[50]:[1],chapter:async()=>[{number:1,text:'<w>Word</w><script>bad()</script> ![image](https://bad) [[injection]]'}]};
 module.config.sourceType='OSIS';const result=await convertToMarkdown(module);const first=result.get('Bible/Test/Genesis/50.md');
 assert.match(first,/bible-book: Gen/);assert.match(first,/# Genesis 50/);assert.match(first,/\*\*1\*\* Word/);assert.match(first,/\^v1/);
 assert.match(first,/\^v1\n\n\[\[Bible\/Test\/Exodus\/1\|Next chapter\]\]\n$/);assert.equal(first.includes('Previous chapter'),false);
 assert.equal(first.includes('<script>'),false);assert.equal(first.includes('bad()'),false);assert.equal(first.includes('![image]'),false);assert.equal(first.includes('[[injection]]'),false);
 assert.match(result.get('Bible/Test/_translation.md'),/Public Domain/);
 const final=result.get('Bible/Test/Exodus/1.md');assert.match(final,/Previous chapter/);assert.match(final,/\^v1\n$/);assert.equal(final.includes('Next chapter'),false);
});

test('imports create Markdown and repeated imports preserve it byte for byte',async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);const zip=zipSync(rawFiles(BOOKS[0],verseIndex));
 await library.install(zip);const path='Bible/Test/Genesis/1.md';const original=await disk.read(path);assert.match(original,/First verse/);
 const writes=disk.writes.length;await library.install(zip);assert.equal(disk.writes.length,writes);assert.equal(await disk.read(path),original);
 disk.files.set(path,original+'\nMy notes');await assert.rejects(()=>library.install(zip),/different content/);assert.equal(await disk.read(path),original+'\nMy notes');
});

test('interrupted chapter export retries missing files and preserves a racing edit',async()=>{
 const disk=new MemoryStorage();const files=new Map([['Bible/Test/Genesis/1.md','first'],['Bible/Test/Genesis/2.md','second']]);
 const original=disk.create.bind(disk);let count=0;disk.create=async(path,text)=>{if(++count===2)throw new Error('Disk full');await original(path,text);};
 await assert.rejects(()=>writeMarkdown(disk,files,()=>false),/Disk full/);assert.equal(await disk.read('Bible/Test/Genesis/1.md'),'first');assert.equal(await disk.read('Bible/Test/Genesis/2.md'),null);
 disk.create=original;await writeMarkdown(disk,files,()=>false);assert.equal(await disk.read('Bible/Test/Genesis/2.md'),'second');
 const racing=new MemoryStorage();racing.create=async(path)=>{racing.files.set(path,'user edit');throw new Error('File already exists');};
 await assert.rejects(()=>writeMarkdown(racing,files,()=>false),/already exists/);assert.equal(await racing.read('Bible/Test/Genesis/1.md'),'user edit');
});

test('earlier native installations can be converted without a download',async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);await library.install(zipSync(rawFiles(BOOKS[0],verseIndex)));
 for(const path of [...disk.files.keys()])if(path.startsWith('Bible/'))disk.files.delete(path);
 await library.convertInstalled();assert.match(await disk.read('Bible/Test/Genesis/1.md'),/First verse/);
});

test('failed import does not activate a source revision and retry completes the Markdown library',async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);const original=disk.create.bind(disk);let calls=0;
 disk.create=async(path,text)=>{if(++calls===2)throw new Error('Disk full');await original(path,text);};
 const archive=zipSync(rawFiles(BOOKS[0],verseIndex));await assert.rejects(()=>library.install(archive),/Disk full/);
 assert.equal(library.modules.length,0);assert.equal([...disk.files.keys()].some(path=>path.endsWith('/ready.json')),false);
 assert.match(await disk.read('Bible/Test/Genesis/1.md'),/First verse/);disk.create=original;
 await library.install(archive);assert.equal(library.modules.length,1);assert.match(await disk.read('Bible/Test/_translation.md'),/Public Domain/);
});

test('title filenames and Bible frontmatter identify chapters while unsafe paths are rejected',()=>{
 const path='Bible/RusDesnitsky/Matthew/18. Смирение, забота о малых и прощение.md';
 const position={translationId:'RusDesnitsky',bookId:'Matt',chapter:18,path};
 assert.deepEqual(positionFromPath(path),position);assert.equal(chapterPath(position),path);
 assert.throws(()=>chapterPath({...position,path:'../outside.md'}));assert.throws(()=>chapterPath({...position,path:'Bible/Other/Matthew/18.md'}));
});

test('ambiguous titled chapter matches are reported instead of opening an arbitrary file',async()=>{
 const {resolveChapter}=await import(process.env.BIBLE_TEST_BUNDLE);const disk=new MemoryStorage();
 for(const name of ['13. First title.md','13. Other title.md'])disk.files.set('Bible/RusDesnitsky/Matthew/'+name,'---\nbible-translation: RusDesnitsky\nbible-book: Matt\nbible-chapter: 13\n---\n');
 await assert.rejects(()=>resolveChapter(disk,{translationId:'RusDesnitsky',bookId:'Matt',chapter:13}),/Several files match/);
});

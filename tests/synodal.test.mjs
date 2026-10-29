import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryStorage } from './helpers.mjs';
const {getCanon,VERSIFICATIONS,verseIndex,chapterPath,positionFromPath,parsePosition,serializePosition,TranslationLibrary}=await import(process.env.BIBLE_TEST_BUNDLE);

test('all standard canons have valid unique books, counts, and monotonic testament indexes',()=>{
 assert.equal(Object.keys(VERSIFICATIONS).length,18);
 for(const [name,books] of Object.entries(VERSIFICATIONS)){
  assert.equal(new Set(books.map(book=>book.id)).size,books.length,name);
  for(const testament of ['ot','nt']){
   let previous=-1;
   for(const book of books.filter(book=>book.testament===testament)){
    assert.ok(book.verses.every(count=>Number.isInteger(count)&&count>=0),`${name}/${book.id}`);
    const index=verseIndex(book,1,1,books);assert.ok(index>previous);previous=index;
   }
  }
 }
 const synodal=getCanon('Synodal');assert.ok(synodal.find(book=>book.id==='Ps').verses.length===151);
 assert.ok(synodal.findIndex(book=>book.id==='Jas')<synodal.findIndex(book=>book.id==='Rom'));
 assert.throws(()=>getCanon('UnknownCanon'));assert.throws(()=>getCanon('__proto__'));
});

test('non-KJV book/chapter references remain portable through paths and state',()=>{
 for(const position of [{translationId:'RusSynodalLIO',bookId:'Ps',chapter:151},{translationId:'Other',bookId:'3Macc',chapter:1}]){
  assert.deepEqual(positionFromPath(chapterPath(position)),position);
  assert.deepEqual(parsePosition(serializePosition(position)),position);
 }
});

const path=process.env.SWORD_SYNODAL_ZIP;
test('the supplied Russian Synodal ZIP converts with correct Russian text and Synodal numbering',{skip:!path},async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);
 await library.install(new Uint8Array(await readFile(path)));
 const module=library.modules.find(item=>item.module.config.id==='RusSynodalLIO')?.module;
 assert.ok(module);assert.equal(module.config.versification,'Synodal');
 const gen=await disk.read('Bible/RusSynodalLIO/Genesis/1.md');assert.match(gen,/В начале сотворил Бог небо и землю/);
 const john=await disk.read('Bible/RusSynodalLIO/John/3.md');assert.match(john,/Ибо так возлюбил Бог мир/);
 const psalm=await disk.read('Bible/RusSynodalLIO/Psalms/50.md');assert.match(psalm,/Помилуй меня/);
 const revelation=await disk.read('Bible/RusSynodalLIO/Revelation of John/22.md');assert.match(revelation,/Аминь/);
 assert.match(await disk.read('Bible/RusSynodalLIO/James/1.md'),/\*\*1\*\* Иаков/);
 assert.match(await disk.read('Bible/RusSynodalLIO/Romans/1.md'),/\*\*1\*\* Павел/);
 const metadata=await disk.read('Bible/RusSynodalLIO/_translation.md');assert.match(metadata,/Synodal/);assert.match(metadata,/Licht im Osten/);
 assert.match(metadata,/Copyrighted/);
 assert.equal([...disk.files.keys()].filter(path=>/^Bible\/RusSynodalLIO\/[^/]+\/\d+\.md$/.test(path)).length,1189);
});

test('all registered book folder names are unique and round-trip across canons',()=>{
 for(const books of Object.values(VERSIFICATIONS))for(const book of books){
  const position={translationId:'Test',bookId:book.id,chapter:book.verses.length};
  assert.deepEqual(positionFromPath(chapterPath(position)),position);
 }
});

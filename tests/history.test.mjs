import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './helpers.mjs';
const {PositionStore,STATE_PATH,serializePosition,parseReadingHistory,serializeReadingHistory,visitHistory,HISTORY_LIMIT,chapterPath}=await import(process.env.BIBLE_TEST_BUNDLE);
const {ReaderController}=await import(process.env.BIBLE_VIEW_BUNDLE);
const gen={translationId:'KJV',bookId:'Gen',chapter:1};
const john={translationId:'KJV',bookId:'John',chapter:3};
const psalm={translationId:'RusSynodalLIO',bookId:'Ps',chapter:50};

function readerFixture() {
 const disk=new MemoryStorage();const opened=[];const restored=[];let reader;
 reader=new ReaderController(disk,async path=>{opened.push(path);await reader.fileOpened(path);},async(path,percent)=>{restored.push({path,percent});});
 for(const position of [gen,john,psalm,{...john,chapter:4},{...gen,chapter:50},{...gen,bookId:'Exod',chapter:1}])disk.files.set(chapterPath(position),'chapter');
 return {disk,reader,opened,restored};
}

test('legacy single positions load as a one-entry history and migrate on the next change',async()=>{
 const disk=new MemoryStorage();disk.files.set(STATE_PATH,serializePosition({...gen,scrollPercent:42}));const state=new PositionStore(disk);await state.load();
 assert.equal(state.history.length,1);assert.equal(state.historyIndex,0);assert.equal(disk.writes.length,0);
 await state.save(john);const migrated=JSON.parse(await disk.read(STATE_PATH));assert.equal(migrated.schemaVersion,2);assert.equal(migrated.history.length,2);assert.equal(migrated.history[0].scrollPercent,42);
 const reopened=new PositionStore(disk);await reopened.load();assert.deepEqual(reopened.history,state.history);assert.equal(reopened.historyIndex,1);
});

test('history is capped at 1000 and drops oldest entries with a valid cursor',()=>{
 let history={entries:[],index:-1};
 for(let index=0;index<1005;index++)history=visitHistory(history,{...gen,translationId:'Translation'+index},'append');
 assert.equal(history.entries.length,HISTORY_LIMIT);assert.equal(history.index,999);assert.equal(history.entries[0].translationId,'Translation5');
 assert.deepEqual(parseReadingHistory(serializeReadingHistory(history)),history);
});

test('back/forward preserve entries and scroll positions without adding visits',async()=>{
 const {disk,reader,opened,restored}=readerFixture();await reader.fileOpened(chapterPath(gen));
 await reader.saveScroll(chapterPath(gen),42,reader.state.position);await reader.fileOpened(chapterPath(john));await reader.saveScroll(chapterPath(john),75,reader.state.position);
 const historyLength=reader.state.history.length;assert.equal(historyLength,2);
 assert.equal(await reader.moveHistory(-1),true);assert.equal(reader.state.historyIndex,0);assert.equal(opened.at(-1),chapterPath(gen));assert.equal(restored.at(-1).percent,42);
 assert.equal(await reader.moveHistory(-1),false);assert.equal(await reader.moveHistory(1),true);assert.equal(restored.at(-1).percent,75);assert.equal(await reader.moveHistory(1),false);
 assert.equal(reader.state.history.length,historyLength);assert.equal(parseReadingHistory(await disk.read(STATE_PATH)).index,1);reader.stop();
});

test('next-chapter progression replaces the current entry, including across book boundaries',async()=>{
 const {disk,reader}=readerFixture();await reader.fileOpened(chapterPath(gen));await reader.fileOpened(chapterPath(john));
 await reader.fileOpened(chapterPath({...john,chapter:4}));assert.equal(reader.state.history.length,2);assert.equal(reader.state.position.chapter,4);
 const lastGenesis={...gen,chapter:50};const firstExodus={...gen,bookId:'Exod',chapter:1};
 disk.files.set(chapterPath(lastGenesis),'# Genesis 50\n\n[[Bible/KJV/Exodus/1|Next chapter]]\n');
 await reader.fileOpened(chapterPath(lastGenesis));const length=reader.state.history.length;
 await reader.fileOpened(chapterPath(firstExodus));assert.equal(reader.state.history.length,length);assert.deepEqual(reader.state.position,firstExodus);reader.stop();
});

test('jumping after going back truncates forward history, while scroll updates preserve it',async()=>{
 const {reader}=readerFixture();await reader.fileOpened(chapterPath(gen));await reader.fileOpened(chapterPath(john));await reader.fileOpened(chapterPath(psalm));
 await reader.moveHistory(-1);await reader.saveScroll(chapterPath(john),37,reader.state.position);assert.equal(reader.state.canGoForward,true);assert.equal(reader.state.history.length,3);
 await reader.moveHistory(-1);await reader.fileOpened(chapterPath(psalm));assert.equal(reader.state.history.length,2);assert.equal(reader.state.canGoForward,false);assert.deepEqual(reader.state.history.map(position=>position.bookId),['Gen','Ps']);reader.stop();
});

test('missing history targets leave cursor/state intact and concurrent back clicks are serialized',async()=>{
 const {disk,reader}=readerFixture();await reader.fileOpened(chapterPath(gen));await reader.fileOpened(chapterPath(john));await reader.fileOpened(chapterPath(psalm));
 await Promise.all([reader.moveHistory(-1),reader.moveHistory(-1)]);assert.equal(reader.state.historyIndex,0);
 const original=await disk.read(STATE_PATH);disk.files.delete(chapterPath(john));await assert.rejects(()=>reader.moveHistory(1),/missing/);assert.equal(reader.state.historyIndex,0);assert.equal(await disk.read(STATE_PATH),original);reader.stop();
});

test('invalid history arrays/cursors are rejected and synced histories are adopted without echo',async()=>{
 for(const history of [{entries:[gen],index:-1},{entries:[],index:0},{entries:[gen],index:2},{entries:Array(1001).fill(gen),index:0}])assert.throws(()=>parseReadingHistory(JSON.stringify({schemaVersion:2,history:history.entries,index:history.index})));
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);const count=disk.writes.length;
 disk.files.set(STATE_PATH,serializeReadingHistory({entries:[gen,john,psalm],index:1}));await state.externalChange();assert.equal(state.history.length,3);assert.equal(state.historyIndex,1);assert.equal(state.canGoForward,true);assert.equal(disk.writes.length,count);
});

test('an incoming synced history during back navigation is preserved instead of overwritten',async()=>{
 const disk=new MemoryStorage();let reader;const incoming=serializeReadingHistory({entries:[gen,psalm],index:1});
 reader=new ReaderController(disk,async path=>{await reader.fileOpened(path);disk.files.set(STATE_PATH,incoming);await reader.state.externalChange();});
 disk.files.set(chapterPath(gen),'chapter');disk.files.set(chapterPath(john),'chapter');await reader.fileOpened(chapterPath(gen));await reader.fileOpened(chapterPath(john));
 await assert.rejects(()=>reader.moveHistory(-1),/history changed/);assert.equal(await disk.read(STATE_PATH),incoming);assert.deepEqual(reader.state.position,psalm);reader.stop();
});

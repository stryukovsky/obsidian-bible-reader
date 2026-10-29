import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './helpers.mjs';
const {serializePosition,parsePosition,STATE_PATH,chapterPath}=await import(process.env.BIBLE_TEST_BUNDLE);
const {ReaderController,ScrollTracker,scrollPercent,applyScrollPercent}=await import(process.env.BIBLE_VIEW_BUNDLE);
const gen={translationId:'KJV',bookId:'Gen',chapter:1};

test('scroll schema is backward compatible and validates percentages',()=>{
 assert.deepEqual(parsePosition(serializePosition(gen)),gen);
 assert.deepEqual(parsePosition(serializePosition({...gen,scrollPercent:42.5})),{...gen,scrollPercent:42.5});
 for(const invalid of [-1,101,'30',null])assert.throws(()=>parsePosition(JSON.stringify({schemaVersion:1,position:{...gen,scrollPercent:invalid}})));
 const element={scrollTop:400,scrollHeight:1000,clientHeight:200};assert.equal(scrollPercent(element),50);
 applyScrollPercent(element,25);assert.equal(element.scrollTop,200);assert.equal(scrollPercent({...element,scrollHeight:200}),0);
});

test('scroll changes save on flush, idle ticks skip writes and resume restores percentage',async()=>{
 const disk=new MemoryStorage();disk.files.set(chapterPath(gen),'chapter');disk.files.set(STATE_PATH,serializePosition(gen));
 let restored;const reader=new ReaderController(disk,async()=>{},async(path,percent)=>{restored={path,percent};});await reader.state.load();
 const element={scrollTop:400,scrollHeight:1000,clientHeight:200};const tracker=new ScrollTracker(reader,()=>({path:chapterPath(gen),element}),()=>Promise.resolve());
 tracker.capture(element);assert.equal(disk.writes.length,0);await tracker.flush();assert.equal(parsePosition(await disk.read(STATE_PATH)).scrollPercent,50);
 await tracker.flush();assert.equal(disk.writes.length,1);tracker.capture(element);await tracker.flush();assert.equal(disk.writes.length,1);
 await reader.openSaved();assert.deepEqual(restored,{path:chapterPath(gen),percent:50});tracker.stop();reader.stop();
});

test('pending scroll never overwrites incoming synced state or a different active chapter',async()=>{
 const disk=new MemoryStorage();const reader=new ReaderController(disk,async()=>{});await reader.state.load();await reader.state.save(gen);
 const element={scrollTop:400,scrollHeight:1000,clientHeight:200};let path=chapterPath(gen);const tracker=new ScrollTracker(reader,()=>({path,element}),()=>Promise.resolve());
 tracker.capture(element);disk.files.set(STATE_PATH,serializePosition({...gen,scrollPercent:75}));await reader.state.externalChange();await tracker.flush();assert.equal(reader.state.position.scrollPercent,75);
 tracker.capture(element);path='Notes/test.md';await tracker.flush();assert.equal(reader.state.position.scrollPercent,75);tracker.stop();reader.stop();
});

test('restoration waits for layout, applies percentage and ignores its own scroll events',async()=>{
 const disk=new MemoryStorage();const reader=new ReaderController(disk,async()=>{});await reader.state.load();await reader.state.save(gen);
 const element={scrollTop:0,scrollHeight:200,clientHeight:200};let attempts=0;
 const tracker=new ScrollTracker(reader,()=>({path:chapterPath(gen),element}),()=>{if(++attempts===2)element.scrollHeight=1000;return Promise.resolve();});
 await tracker.restore(chapterPath(gen),50);assert.equal(element.scrollTop,400);await tracker.flush();assert.equal(disk.writes.length,1);
 tracker.stop();tracker.capture(element);await tracker.flush();assert.equal(disk.writes.length,1);reader.stop();
});

test('scroll tracking uses saved actual chapter paths for titled notes',async()=>{
 const disk=new MemoryStorage();const path='Bible/RusDesnitsky/Matthew/Смирение.md';const reference={translationId:'RusDesnitsky',bookId:'Matt',chapter:18,path};
 const reader=new ReaderController(disk,async()=>{});await reader.state.load();await reader.state.save(reference);
 const element={scrollTop:400,scrollHeight:1000,clientHeight:200};const tracker=new ScrollTracker(reader,()=>({path,element}),()=>Promise.resolve());
 tracker.capture(element);await tracker.flush();assert.equal(reader.state.position.scrollPercent,50);assert.equal(reader.state.position.path,path);tracker.stop();reader.stop();
});

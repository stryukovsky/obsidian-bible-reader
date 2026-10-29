import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as nodeTimeout } from 'node:timers';
import { Window } from 'happy-dom';
import { MemoryStorage } from './helpers.mjs';
const {STATE_PATH,serializePosition,chapterPath}=await import(process.env.BIBLE_TEST_BUNDLE);
const {ReaderController,BibleReaderPlugin}=await import(process.env.BIBLE_VIEW_BUNDLE);

const gen={translationId:'KJV',bookId:'Gen',chapter:1};
const john={translationId:'KJV',bookId:'John',chapter:3};
const settle=()=>new Promise(resolve=>nodeTimeout(resolve,20));

function setupDom() {
 const window=new Window();globalThis.document=window.document;globalThis.DOMParser=window.DOMParser;
 const proto=window.HTMLElement.prototype;
 proto.setText=function(text){this.textContent=text;};
 proto.empty=function(){this.replaceChildren();};
 proto.createEl=function(tag,options={}){
  const element=this.ownerDocument.createElement(tag);
  if(options.text!==undefined)element.textContent=options.text;
  for(const[key,value]of Object.entries(options.attr??{}))element.setAttribute(key,value);
  this.append(element);return element;
 };
 proto.createDiv=function(options){return this.createEl('div',options);};
 proto.createSpan=function(options){return this.createEl('span',options);};
 return window;
}

test('opening Bible Markdown files saves position and unrelated notes do not reset it',async()=>{
 const disk=new MemoryStorage();const controller=new ReaderController(disk,async()=>{});
 await controller.fileOpened('Bible/KJV/Genesis/1.md');assert.deepEqual(controller.state.position,gen);
 const writes=disk.writes.length;await controller.fileOpened('Notes/today.md');await controller.fileOpened(null);assert.equal(disk.writes.length,writes);
 await controller.fileOpened('Bible/KJV/John/3.md');assert.deepEqual(controller.state.position,john);controller.stop();
});

test('resume opens the synced chapter as a normal file without echo writes or SWORD files',async()=>{
 const disk=new MemoryStorage();disk.files.set(STATE_PATH,serializePosition(gen));disk.files.set(chapterPath(gen),'# Genesis 1');disk.files.set(chapterPath(john),'# John 3');
 const opened=[];const controller=new ReaderController(disk,async path=>{opened.push(path);await controller.fileOpened(path);});
 assert.equal(await controller.openSaved(),true);assert.deepEqual(opened,['Bible/KJV/Genesis/1.md']);assert.equal(disk.writes.length,0);
 disk.files.set(STATE_PATH,serializePosition(john));await controller.openSaved();assert.equal(opened.at(-1),'Bible/KJV/John/3.md');assert.equal(disk.writes.length,0);
 controller.stop();
});

test('first resume opens the first Markdown chapter and empty vault asks for installation',async()=>{
 const disk=new MemoryStorage();const paths=[];const controller=new ReaderController(disk,async path=>{paths.push(path);});
 assert.equal(await controller.openSaved(),false);
 disk.files.set(chapterPath(gen),'chapter');assert.equal(await controller.openSaved(),true);assert.deepEqual(controller.state.position,gen);assert.equal(paths[0],chapterPath(gen));controller.stop();
});

test('missing synced chapter and malformed state are preserved',async()=>{
 const disk=new MemoryStorage();disk.files.set(STATE_PATH,serializePosition(john));const controller=new ReaderController(disk,async()=>{throw new Error('Must not open a fallback');});
 await assert.rejects(()=>controller.openSaved(),/Saved chapter is missing/);assert.equal(disk.writes.length,0);
 disk.files.set(STATE_PATH,'<<<<<<< conflict');await assert.rejects(()=>controller.openSaved());assert.equal(disk.files.get(STATE_PATH),'<<<<<<< conflict');controller.stop();
});

test('rapid file changes retain the final chapter and stopped controllers ignore events',async()=>{
 const disk=new MemoryStorage();const controller=new ReaderController(disk,async()=>{});
 await Promise.all([controller.fileOpened(chapterPath(gen)),controller.fileOpened(chapterPath(john))]);assert.deepEqual(controller.state.position,john);
 controller.stop();const count=disk.writes.length;await controller.fileOpened(chapterPath(gen));assert.equal(disk.writes.length,count);
});

test('plugin ribbon uses normal Markdown openFile and cleans up workspace/vault events',async()=>{
 const window=setupDom();
 // The bundle has its own TFile constructor; obtain it through an exported test-only mock.
 const {mockFile}=await import(process.env.BIBLE_VIEW_BUNDLE);
 const events=new Set();const vaultEvents=new Set();const opened=[];
 const state=serializePosition(john);const file=mockFile(chapterPath(john));
 const app={
  vault:{adapter:{exists:async path=>path===STATE_PATH||path===file.path,read:async path=>path===STATE_PATH?state:'# John 3'},getAbstractFileByPath:path=>path===file.path?file:null,
   on:(name,callback)=>{const event={name,callback};vaultEvents.add(event);return event;},offref:event=>vaultEvents.delete(event)},
  workspace:{getActiveViewOfType:()=>null,onLayoutReady:callback=>callback(),on:(name,callback)=>{const event={name,callback};events.add(event);return event;},offref:event=>events.delete(event),getLeaf:()=>({openFile:async openedFile=>{opened.push(openedFile.path);for(const event of events)event.callback(openedFile);}})},
 };
 const plugin=new BibleReaderPlugin(app);plugin.onload();
 assert.deepEqual(plugin.commands.map(command=>command.id),['open-bible-reader','install-bible-translation','recover-reading-position','sync-current-reading-bookmark','previous-reading-position','next-reading-position']);
 assert.equal(plugin.views.size,0);assert.equal(vaultEvents.size,5);assert.equal(events.size,3);
 plugin.ribbon();await settle();assert.deepEqual(opened,['Bible/KJV/John/3.md']);
 plugin.unload();assert.equal(events.size,0);assert.equal(vaultEvents.size,0);
 await window.happyDOM.abort();
});

test('restoring an old workspace tab cannot overwrite synced position before layout is ready',async()=>{
 const window=setupDom();const {mockFile}=await import(process.env.BIBLE_VIEW_BUNDLE);
 const listeners=new Map();let ready;const saved=serializePosition(john);let writes=0;
 const app={vault:{adapter:{exists:async()=>true,read:async()=>saved},on:(name,callback)=>({name,callback}),offref:()=>{}},workspace:{getActiveViewOfType:()=>null,onLayoutReady:callback=>{ready=callback;},on:(name,callback)=>{listeners.set(name,callback);return{name,callback};},offref:()=>{}}};
 const plugin=new BibleReaderPlugin(app);plugin.onload();
 plugin.reader.state.save=()=>{writes++;return Promise.resolve();};
 listeners.get('file-open')(mockFile(chapterPath(gen)));await settle();assert.equal(writes,0);
 ready();listeners.get('file-open')(mockFile(chapterPath(gen)));await settle();assert.equal(writes,1);
 plugin.unload();await window.happyDOM.abort();
});

test('history ribbon buttons reflect bounds and move without appending new entries',async()=>{
 const window=setupDom();const {mockPlugin,registerHistoryControls}=await import(process.env.BIBLE_VIEW_BUNDLE);
 const disk=new MemoryStorage();disk.files.set(chapterPath(gen),'chapter');disk.files.set(chapterPath(john),'chapter');
 let reader;reader=new ReaderController(disk,async path=>reader.fileOpened(path));await reader.state.load();await reader.state.save(gen);await reader.state.save(john);
 const plugin=mockPlugin({workspace:{onLayoutReady:callback=>callback()}});registerHistoryControls(plugin,reader);
 const [back,forward]=plugin.ribbons;assert.equal(back.icon,'chevron-left');assert.equal(forward.icon,'chevron-right');
 assert.equal(back.element.getAttribute('aria-disabled'),'false');assert.equal(forward.element.getAttribute('aria-disabled'),'true');
 back.action();await settle();assert.equal(reader.state.historyIndex,0);assert.equal(back.element.getAttribute('aria-disabled'),'true');assert.equal(forward.element.getAttribute('aria-disabled'),'false');
 forward.action();await settle();assert.equal(reader.state.historyIndex,1);assert.equal(reader.state.history.length,2);
 plugin.unload();await reader.state.travel(-1);assert.equal(back.element.getAttribute('aria-disabled'),'false');reader.stop();await window.happyDOM.abort();
});

test('current reading bookmark subscribes to saved chapters and stops updating on unload',async()=>{
 const window=setupDom();const {mockPlugin,mockFile,registerCurrentReadingBookmark}=await import(process.env.BIBLE_VIEW_BUNDLE);
 const disk=new MemoryStorage();disk.files.set(chapterPath(gen),'chapter');disk.files.set(chapterPath(john),'chapter');const reader=new ReaderController(disk,async()=>{});let saves=0;
 const core={items:[],onItemsChanged:()=>{saves++;}};
 const app={internalPlugins:{getPluginById:()=>({enabled:true,instance:core})},vault:{getAbstractFileByPath:path=>mockFile(path),on:()=>({}),offref:()=>{}},workspace:{onLayoutReady:callback=>callback(),offref:()=>{}}};
 const plugin=mockPlugin(app);const bookmark=registerCurrentReadingBookmark(plugin,reader);await reader.state.load();await reader.state.save(gen);await bookmark.sync();
 assert.equal(core.items.length,1);assert.equal(core.items[0].path,chapterPath(gen));const initialSaves=saves;
 await reader.saveScroll(chapterPath(gen),50,reader.state.position);await bookmark.sync();assert.equal(saves,initialSaves);
 await reader.state.save(john);await bookmark.sync();assert.equal(core.items.length,1);assert.equal(core.items[0].path,chapterPath(john));assert.equal('scrollPercent' in core.items[0],false);
 plugin.unload();await reader.state.save(gen);assert.equal(await bookmark.sync(),'stopped');assert.equal(core.items[0].path,chapterPath(john));reader.stop();await window.happyDOM.abort();
});

test('titled Russian chapter notes save their actual path and resume without a numeric-only file',async()=>{
 const disk=new MemoryStorage();const path='Bible/RusDesnitsky/Matthew/18. Смирение, забота о малых и прощение.md';
 disk.files.set(path,'---\nbible-translation: RusDesnitsky\nbible-book: Matt\nbible-chapter: 18\n---\n\n# Matthew 18');
 const opened=[];const reader=new ReaderController(disk,async value=>{opened.push(value);});await reader.fileOpened(path);
 assert.equal(reader.state.position.chapter,18);assert.equal(reader.state.position.path,path);assert.match(await disk.read(STATE_PATH),/Смирение/);
 await reader.openSaved();assert.equal(opened.at(-1),path);reader.stop();
});

test('legacy state locates titled chapters through their metadata and repairs its active history entry',async()=>{
 const disk=new MemoryStorage();const path='Bible/RusDesnitsky/Matthew/13. Притчи о Царстве Небес.md';
 const position={translationId:'RusDesnitsky',bookId:'Matt',chapter:13,scrollPercent:18.98};
 disk.files.set(STATE_PATH,serializePosition(position));disk.files.set(path,'---\nbible-translation: RusDesnitsky\nbible-book: Matt\nbible-chapter: 13\n---\n');
 const opened=[];const reader=new ReaderController(disk,async value=>{opened.push(value);});await reader.openSaved();
 assert.equal(opened[0],path);assert.equal(reader.state.history.length,1);assert.equal(reader.state.position.path,path);assert.equal(reader.state.position.scrollPercent,18.98);reader.stop();
});

test('Bible reference frontmatter works when a chapter filename has no number',async()=>{
 const disk=new MemoryStorage();const path='Bible/RusDesnitsky/Matthew/Смирение.md';
 disk.files.set(path,'---\nbible-translation: RusDesnitsky\nbible-book: Matt\nbible-chapter: 18\n---\n');
 const opened=[];const reader=new ReaderController(disk,async value=>{opened.push(value);});await reader.openSaved();assert.equal(opened[0],path);assert.equal(reader.state.position.chapter,18);
 await reader.saveScroll(path,42,reader.state.position);assert.equal(reader.state.position.scrollPercent,42);reader.stop();
});

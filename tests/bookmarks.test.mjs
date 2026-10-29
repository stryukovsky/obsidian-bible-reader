import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './helpers.mjs';
const {PositionStore,CURRENT_READING_BOOKMARK,coreBookmarks,updateCurrentBookmark,CurrentReadingBookmark,STATE_PATH,serializeReadingHistory,chapterPath}=await import(process.env.BIBLE_TEST_BUNDLE);
const gen={translationId:'KJV',bookId:'Gen',chapter:1,scrollPercent:75};
const john={translationId:'RusSynodalLIO',bookId:'John',chapter:3,scrollPercent:42};

test('managed bookmark updates in place across chapters and preserves unrelated/grouped items',()=>{
 const personal={type:'file',path:'Notes/personal.md',title:'Personal',ctime:1};
 const managed={type:'file',path:'Bible/KJV/Genesis/1.md',title:CURRENT_READING_BOOKMARK,ctime:2,subpath:'#Verse 1',scrollPercent:80};
 const group={type:'group',title:'Reading',items:[managed,personal],ctime:3};
 const core={items:[group],onItemsChanged:()=>{}};
 assert.equal(updateCurrentBookmark(core,chapterPath(john)),true);assert.equal(managed.path,chapterPath(john));assert.equal(managed.ctime,2);
 assert.equal('subpath' in managed,false);assert.equal('scrollPercent' in managed,false);assert.deepEqual(personal,{type:'file',path:'Notes/personal.md',title:'Personal',ctime:1});
 assert.equal(core.items[0],group);assert.equal(group.items.length,2);assert.equal(updateCurrentBookmark(core,chapterPath(john)),false);
});

test('new bookmarks have chapter paths with no scroll or heading state',()=>{
 const core={items:[],onItemsChanged:()=>{}};updateCurrentBookmark(core,chapterPath(gen),()=>123);
 assert.deepEqual(core.items,[{type:'file',ctime:123,path:'Bible/KJV/Genesis/1.md',title:CURRENT_READING_BOOKMARK}]);
});

test('core API adapter requires an enabled Bookmarks plugin with a supported shape',()=>{
 const core={items:[],onItemsChanged:()=>{}};let requested;
 assert.equal(coreBookmarks({internalPlugins:{getPluginById(id){requested=id;return{enabled:true,instance:core};}}}).items,core.items);assert.equal(requested,'bookmarks');
 for(const app of [{},{internalPlugins:{}},{internalPlugins:{getPluginById:()=>({enabled:false,instance:core})}},{internalPlugins:{getPluginById:()=>({enabled:true,instance:{items:[]}})}}])assert.equal(coreBookmarks(app),null);
});

test('bookmark follows current history, ignores scroll-only updates, and adopts synced cursor',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();let saves=0;
 const core={items:[],onItemsChanged:save=>{assert.equal(save,true);saves++;}};const bookmark=new CurrentReadingBookmark(state,()=>core,()=>true);
 await state.save(gen);assert.equal(await bookmark.sync(),'updated');assert.equal(saves,1);
 await state.save({...gen,scrollPercent:90},'replace');assert.equal(await bookmark.sync(),'unchanged');assert.equal(saves,1);
 await state.save(john);await bookmark.sync();assert.equal(core.items.length,1);assert.equal(core.items[0].path,chapterPath(john));
 await state.travel(-1);await bookmark.sync();assert.equal(core.items[0].path,chapterPath(gen));
 const writes=disk.writes.length;disk.files.set(STATE_PATH,serializeReadingHistory({entries:[gen,john],index:1}));await state.externalChange();await bookmark.sync();assert.equal(core.items[0].path,chapterPath(john));assert.equal(disk.writes.length,writes);
 bookmark.stop();await state.travel(-1);assert.equal(await bookmark.sync(),'stopped');assert.equal(core.items[0].path,chapterPath(john));
});

test('disabled Bookmarks, missing chapters, and invalid reading state leave user bookmarks alone',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);
 const core={items:[{type:'file',title:'Personal',path:'Personal.md'}],onItemsChanged:()=>{throw new Error('Must not save');}};
 assert.equal(await new CurrentReadingBookmark(state,()=>null,()=>true).sync(),'unavailable');
 assert.equal(await new CurrentReadingBookmark(state,()=>core,()=>false).sync(),'missing');
 disk.files.set(STATE_PATH,'<<<<<<< conflict');await state.externalChange();assert.equal(await new CurrentReadingBookmark(state,()=>core,()=>true).sync(),'empty');assert.equal(core.items.length,1);
});

test('failed core saves can retry without duplicating the bookmark',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);let calls=0;
 const core={items:[],onItemsChanged:()=>{if(++calls===1)throw new Error('Save failed');}};
 const bookmark=new CurrentReadingBookmark(state,()=>core,()=>true);await assert.rejects(()=>bookmark.sync(),/Save failed/);assert.equal(await bookmark.sync(),'updated');assert.equal(calls,2);assert.equal(core.items.length,1);
});

 test('native adapter saves through the core plugin and refreshes its existing pane',async()=>{
 let saved=0,refreshed=0;
 const core={items:[],onItemsChanged(save){assert.equal(this,core);assert.equal(save,true);saved++;}};
 const view={update(){assert.equal(this,view);refreshed++;}};
 const adapter=coreBookmarks({internalPlugins:{getPluginById:()=>({enabled:true,instance:core})},workspace:{getLeavesOfType:type=>{assert.equal(type,'bookmarks');return[{view}];}}});
 await adapter.onItemsChanged(true);assert.equal(saved,1);assert.equal(refreshed,1);
});

test('legacy numeric reading state bookmarks a titled chapter when no numeric file exists',async()=>{
 const {resolveChapter}=await import(process.env.BIBLE_TEST_BUNDLE);const disk=new MemoryStorage();
 const path='Bible/RusDesnitsky/Matthew/13. Притчи о Царстве Небес.md';const position={translationId:'RusDesnitsky',bookId:'Matt',chapter:13};
 disk.files.set(path,'---\nbible-translation: RusDesnitsky\nbible-book: Matt\nbible-chapter: 13\n---\n');disk.files.set(STATE_PATH,JSON.stringify({schemaVersion:1,position}));
 const state=new PositionStore(disk);await state.load();const core={items:[],onItemsChanged:()=>{}};
 const bookmark=new CurrentReadingBookmark(state,()=>core,actual=>disk.files.has(actual),async reference=>{const resolved=await resolveChapter(disk,reference);return resolved?chapterPath(resolved):null;});
 assert.equal(await bookmark.sync(),'updated');assert.equal(core.items[0].path,path);assert.equal('scrollPercent' in core.items[0],false);
});

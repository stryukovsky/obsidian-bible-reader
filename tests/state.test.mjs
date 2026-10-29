import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './helpers.mjs';
const { PositionStore, STATE_PATH, parsePosition, serializePosition }=await import(process.env.BIBLE_TEST_BUNDLE);
const john={translationId:'KJV',bookId:'John',chapter:3};
const gen={translationId:'KJV',bookId:'Gen',chapter:1};

test('serialized navigation survives reopen and skips identical writes',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();
 await Promise.all([state.save(gen),state.save(john)]);assert.deepEqual(parsePosition(await disk.read(STATE_PATH)),john);
 await state.save(john);assert.equal(disk.writes.length,2);
 const reopened=new PositionStore(disk);await reopened.load();assert.deepEqual(reopened.position,john);
 const other=new PositionStore(new MemoryStorage());await other.load();assert.equal(other.position,null);
});

test('external updates adopt without echo, invalid state is preserved and recovery backs up',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);
 disk.files.set(STATE_PATH,serializePosition(john));await state.externalChange();assert.deepEqual(state.position,john);assert.equal(disk.writes.length,1);
 const invalid='<<<<<<< HEAD\nconflict';disk.files.set(STATE_PATH,invalid);await state.externalChange();assert.equal(state.blocked,true);
 await assert.rejects(()=>state.save(gen));assert.equal(await disk.read(STATE_PATH),invalid);
 await state.keepLocal(gen);assert.deepEqual(parsePosition(await disk.read(STATE_PATH)),gen);
 assert.equal([...disk.files.entries()].some(([path,text])=>path.includes('state-backup-')&&text===invalid),true);
 disk.files.delete(STATE_PATH);await state.externalChange();assert.equal(state.blocked,true);
});

test('pending local save detects incoming reference and awaits explicit resolution',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);
 const pending=state.save({...gen,chapter:2});disk.files.set(STATE_PATH,serializePosition(john));
 await assert.rejects(()=>pending,/changed outside/);assert.equal(state.blocked,true);assert.deepEqual(state.incoming,john);
 await state.useIncoming();assert.deepEqual(state.position,john);assert.equal(state.blocked,false);
});

test('write errors retain unsaved local position and retry succeeds',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();disk.failWrite=true;
 await assert.rejects(()=>state.save(john),/Disk full/);assert.deepEqual(state.position,john);assert.equal(await disk.read(STATE_PATH),null);
 disk.failWrite=false;await state.keepLocal(john);assert.equal(state.blocked,false);assert.deepEqual(parsePosition(await disk.read(STATE_PATH)),john);
});

test('schema and reference validation preserves unknown versions and rejects invalid chapters',async()=>{
 for(const text of ['{"schemaVersion":2,"position":{}}',serializePosition(john).replace('"chapter": 3','"chapter": 300'),'{}'])assert.throws(()=>parsePosition(text));
 const disk=new MemoryStorage();const raw='{"schemaVersion":2,"position":{}}';disk.files.set(STATE_PATH,raw);
 const state=new PositionStore(disk);await state.load();assert.equal(state.blocked,true);assert.equal(await disk.read(STATE_PATH),raw);
});

test('refresh accepts a formerly valid state restored after conflict repair',async()=>{
 const disk=new MemoryStorage();const state=new PositionStore(disk);await state.load();await state.save(gen);
 const original=await disk.read(STATE_PATH);disk.files.set(STATE_PATH,'invalid');await state.externalChange();assert.equal(state.blocked,true);
 disk.files.set(STATE_PATH,original);await state.externalChange();assert.equal(state.blocked,false);assert.deepEqual(state.position,gen);
});

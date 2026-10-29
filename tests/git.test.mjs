import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const {PositionStore, STATE_PATH, serializeReadingHistory}=await import(process.env.BIBLE_TEST_BUNDLE);

test('a committed reading history restores in a second Git checkout',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'bible-reader-git-'));const a=join(folder,'a'),b=join(folder,'b');
 const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const position={translationId:'KJV',bookId:'John',chapter:3};
 try{
  await mkdir(join(a,'Bible reader'),{recursive:true});git(a,'init');git(a,'config','user.name','Reader test');git(a,'config','user.email','reader-test@example.invalid');
  await writeFile(join(a,STATE_PATH),serializeReadingHistory({entries:[position,{...position,bookId:'Ps',chapter:50,scrollPercent:37}],index:0}));git(a,'add',STATE_PATH);git(a,'commit','-m','Save reading position');
  git(a,'worktree','add','--quiet','--detach',b,'HEAD');
  const store=new PositionStore({read:async path=>{try{return await readFile(join(b,path),'utf8');}catch{return null;}},write:async()=>{throw new Error('Restore must not write');}});
  await store.load();assert.deepEqual(store.position,position);assert.equal(store.blocked,false);assert.equal(store.history.length,2);assert.equal(store.historyIndex,0);assert.equal(store.history[1].scrollPercent,37);
 }finally{await rm(folder,{recursive:true,force:true});}
});

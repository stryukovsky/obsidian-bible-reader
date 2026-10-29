import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { MemoryStorage, rawFiles, configText } from './helpers.mjs';
const { BOOKS,verseIndex,openArchive,TranslationLibrary,LIBRARY,MAX_ARCHIVE }=await import(process.env.BIBLE_TEST_BUNDLE);
const files=()=>rawFiles(BOOKS[0],verseIndex);

test('ZIP imports preserve native files and rediscover offline',async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);const bytes=zipSync(files());
 assert.equal(await library.install(bytes),'Test');assert.equal(library.modules.length,1);
 const root=library.modules[0].root;assert.match(root,new RegExp('^'+LIBRARY+'/Test/[a-f0-9]{64}$'));
 assert.deepEqual(await disk.readBinary(root+'/modules/texts/rawtext/test/ot'),files()['modules/texts/rawtext/test/ot']);
 const offline=new TranslationLibrary(disk);await offline.refresh();assert.equal((await offline.modules[0].module.chapter('Gen',1))[0].text,'First verse.');
});

test('unsafe and incompatible archives are rejected',async()=>{
 for(const path of ['../escape','/absolute','modules\\escape'])await assert.rejects(()=>openArchive(zipSync({...files(),[path]:strToU8('bad')})),/Unsafe/);
 await assert.rejects(()=>openArchive(new Uint8Array(MAX_ARCHIVE+1)),/limit/);
 await assert.rejects(()=>openArchive(zipSync({...files(),'mods.d/other.conf':strToU8(configText)})),/one mods/);
 await assert.rejects(()=>openArchive(zipSync({...files(),'mods.d/test.conf':strToU8(configText+'CipherKey=\n')})),/Locked/);
});

test('failed replacement leaves working revision available and incomplete staging invisible',async()=>{
 const disk=new MemoryStorage();const library=new TranslationLibrary(disk);await library.install(zipSync(files()));
 const oldRoot=library.modules[0].root;disk.failWrite=true;
 await assert.rejects(()=>library.install(zipSync({...files(),'mods.d/test.conf':strToU8(configText+'Version=2\n')})),/different content/);
 disk.failWrite=false;disk.files.set(LIBRARY+'/Test/incomplete/mods.d/test.conf',configText);await library.refresh();
 assert.equal(library.modules.length,1);assert.equal(library.modules[0].root,oldRoot);
});

const officialZip=process.env.SWORD_KJV_ZIP;
test('official CrossWire KJV installs natively and reopens from vault storage', {skip:!officialZip},async()=>{
 const {readFile}=await import('node:fs/promises');const disk=new MemoryStorage();const library=new TranslationLibrary(disk);
 await library.install(new Uint8Array(await readFile(officialZip)));assert.equal(library.modules[0].module.config.id,'KJV');
 const reopened=new TranslationLibrary(disk);await reopened.refresh();assert.equal(reopened.modules[0].module.config.license,'GPL');
 assert.match((await reopened.modules[0].module.chapter('John',3))[15].text,/God/);
 assert.equal(reopened.warnings.length,0);
 const chapters=[...disk.files.keys()].filter(path=>/^Bible\/KJV\/[^/]+\/\d+\.md$/.test(path));assert.equal(chapters.length,1189);
 assert.match(await disk.read('Bible/KJV/Genesis/1.md'),/In the beginning/);
 assert.match(await disk.read('Bible/KJV/John/3.md'),/For God so loved the world/);
 assert.match(await disk.read('Bible/KJV/Revelation of John/22.md'),/Amen/);
});

test('ZIP CRC and declared expansion limits are checked before installation',async()=>{
 const crc=zipSync(files(),{level:0});
 const view=new DataView(crc.buffer);let central=-1;
 for(let at=0;at+46<crc.length;at++)if(view.getUint32(at,true)===0x02014b50){central=at;break;}
 assert.notEqual(central,-1);view.setUint32(central+16,view.getUint32(central+16,true)^1,true);
 await assert.rejects(()=>openArchive(crc),/checksum/);
 const huge=zipSync(files());const h=new DataView(huge.buffer);
 for(let at=0;at+46<huge.length;at++)if(h.getUint32(at,true)===0x02014b50){h.setUint32(at+24,65*1024*1024,true);break;}
 await assert.rejects(()=>openArchive(huge),/expansion/);
});

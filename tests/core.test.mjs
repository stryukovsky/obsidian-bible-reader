import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zlibSync } from 'fflate';
import { Window } from 'happy-dom';
import { rawFiles, configText } from './helpers.mjs';
const { BOOKS, verseIndex, parseConfig, safePath, SwordModule, adjacent, hasPosition, verseText, openArchive } = await import(process.env.BIBLE_TEST_BUNDLE);

test('config rejects incompatible modules and unsafe paths', () => {
 for (const path of ['../x','/x','modules/../x','C:/x','modules\\x','modules//x']) assert.throws(() => safePath(path));
 for (const change of ['ModDrv=zText4','Versification=UnknownCanon','CipherKey=','Encoding=UTF-16','SourceType=Unsupported']) {
  const key=change.split('=')[0];
  assert.throws(() => parseConfig(configText.replace(new RegExp('^'+key+'=.*$','m'),'')+'\n'+change));
 }
 assert.equal(parseConfig(configText).driver,'RawText');
});

test('RawText handles introduction slots, missing testaments and corrupt offsets', async () => {
 const book=BOOKS[0];const files=rawFiles(book,verseIndex);
 const read=async path => { if (!files[path]) throw new Error('missing');return files[path]; };
 const module=new SwordModule(parseConfig(configText),read);await module.initialize();
 assert.equal(verseIndex(book,1,1),4);
 assert.deepEqual(await module.chapter('Gen',1),[{number:1,text:'First verse.'},{number:2,text:'Second verse.'}]);
 assert.deepEqual(module.books.map(b=>b.id),['Gen']);
 assert.equal(hasPosition(module,{bookId:'Gen',chapter:2}),false);
 assert.equal(adjacent(module,{bookId:'Gen',chapter:1},-1),null);
 await assert.rejects(()=>module.chapter('Gen',2),/does not contain/);
 new DataView(files['modules/texts/rawtext/test/ot.vss'].buffer).setUint32(4*6,999999,true);
 await assert.rejects(()=>new SwordModule(parseConfig(configText),read).initialize(),/exceeds data/);
});

test('zText validates block bounds and checksums', async () => {
 const book=BOOKS[0];const text=new TextEncoder().encode('Compressed verse.');const packed=zlibSync(text);
 const index=new Uint8Array((verseIndex(book,1,1)+1)*10);new DataView(index.buffer).setUint16(4*10+8,text.length,true);
 const blocks=new Uint8Array(12);const b=new DataView(blocks.buffer);b.setUint32(4,packed.length,true);b.setUint32(8,text.length,true);
 const files={'modules/texts/rawtext/test/ot.bzv':index,'modules/texts/rawtext/test/ot.bzs':blocks,'modules/texts/rawtext/test/ot.bzz':packed};
 const config=parseConfig(configText.replace('ModDrv=RawText','ModDrv=zText')+'CompressType=ZIP\nBlockType=BOOK\n');
 const read=async path=>{if(!files[path])throw new Error('missing');return files[path];};
 const module=new SwordModule(config,read);await module.initialize();
 assert.equal((await module.chapter('Gen',1))[0].text,'Compressed verse.');
 packed[packed.length-1]^=1;
 const corrupt=new SwordModule(config,read);await corrupt.initialize();await assert.rejects(()=>corrupt.chapter('Gen',1),/checksum/);
 b.setUint32(8,100*1024*1024,true);await assert.rejects(()=>new SwordModule(config,read).initialize(),/safety limits/);
});

test('markup is reduced to text without executable DOM or footnotes', () => {
 const window=new Window();globalThis.DOMParser=window.DOMParser;
 const text=verseText('<w lemma="x">God</w> so loved<note>hidden note</note> &amp; <script>bad()</script><img onerror="bad()"/>the world','OSIS');
 assert.equal(text,'God so loved & the world');
 const target=window.document.createElement('div');target.textContent=text;
 assert.equal(target.querySelectorAll('script,img').length,0);
 assert.equal(verseText('<FI>Added<Fi> text<RF>footnote<Rf>','GBF'),'Added text');
 assert.equal(verseText('<w>fragment</w><chapter eID="x"/>','OSIS'),'fragment');
 window.happyDOM.abort();
});

const realArchive=process.env.SWORD_KJV_ZIP;
test('official CrossWire KJV first/last verses, book boundaries and block eviction', {skip:!realArchive}, async () => {
 const archive=await openArchive(new Uint8Array(await readFile(realArchive)));
 const module=new SwordModule(archive.config,async path=>{if(!archive.files[path])throw new Error('missing');return archive.files[path];});await module.initialize();
 assert.equal(module.books.length,66);
 const gen=await module.chapter('Gen',1);assert.equal(gen.length,31);assert.match(gen[0].text,/In the beginning/);
 const john=await module.chapter('John',3);assert.equal(john.length,36);assert.match(john[15].text,/For/);
 const rev=await module.chapter('Rev',22);assert.equal(rev.length,21);assert.match(rev[20].text,/Amen/);
 assert.deepEqual(adjacent(module,{translationId:'KJV',bookId:'Gen',chapter:50},1),{translationId:'KJV',bookId:'Exod',chapter:1});
 assert.equal(adjacent(module,{translationId:'KJV',bookId:'Rev',chapter:22},1),null);
 assert.deepEqual(await module.chapter('Gen',1),gen);
});

// Run with Node.js 18+: node tests/tokenizer.cjs. No npm install required.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const messages=[];
const context=vm.createContext({TextEncoder,console,setTimeout,clearTimeout,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,
 XMLHttpRequest:class {
  open(method,url){this.url=url;}
  send(){fs.readFile(path.resolve(root,'engine',this.url),(error,b)=>{
   if(error)return this.onerror(error);
   this.status=200;this.response=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);this.onload();
  });}
 }
});
context.self=context;
context.postMessage=m=>messages.push(m);
context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,'engine',file),'utf8'),context);};
vm.runInContext(fs.readFileSync(path.join(root,'engine/worker.js'),'utf8'),context);
const samples=[
 ['今日は図書館で新しい本を読みました。','きょうはとしょかんであたらしいほんをよみました。'],
 ['食べる、食べた、走っています。','たべる、たべた、はしっています。'],
 ['野獸先輩と神絵師の配信を見る。','やじゅうせんぱいとかみえしのはいしんをみる。'],
 ['𠮷野家で勉強📚 日本語を話します。',null],
 ['  今日\n学校へ行く！','  きょう\nがっこうへいく！'],
 ['麤龘靐','麤龘靐']
];
(async()=>{
 for(const [id,[text]] of samples.entries())context.onmessage({data:{id,text}});
 await vm.runInContext('queue',context);
 assert.equal(messages.length,samples.length);
 for(const {id,tokens,error} of messages){
  assert.ok(!error,error);const [text,reading]=samples[id];
  assert.equal(tokens.map(t=>t.surface).join(''),text);
  for(const t of tokens)assert.equal(text.slice(t.start,t.end),t.surface);
  if(reading)assert.equal(tokens.map(t=>t.reading||t.surface).join(''),reading);
 }
 assert.ok(messages[5].tokens.every(t=>t.unknown));
 // Repeat exercises the cache and preserves offset-bearing results.
 context.onmessage({data:{id:99,text:samples[0][0]}});
 await vm.runInContext('queue',context);
 assert.deepEqual(messages.at(-1).tokens,messages[0].tokens);
 // A user name spans default token boundaries and wins longest-first.
 context.onmessage({data:{id:100,text:'星街すいせいを見る',dictionary:[{word:'星街',reading:'ほしまち'},{word:'星街すいせい',reading:'ホシマチスイセイ'}]}});
 await vm.runInContext('queue',context);
 assert.equal(messages.at(-1).tokens[0].surface,'星街すいせい');
 assert.equal(messages.at(-1).tokens[0].reading,'ほしまちすいせい');
 // Updating the same input must invalidate the worker cache.
 context.onmessage({data:{id:101,text:'星街すいせいを見る',dictionary:[{word:'星街すいせい',reading:'すいせい'}]}});
 await vm.runInContext('queue',context);
 assert.equal(messages.at(-1).tokens[0].reading,'すいせい');
 context.onmessage({data:{id:102,text:'星街すいせいを見る',dictionary:[]}});
 await vm.runInContext('queue',context);
 assert.notEqual(messages.at(-1).tokens[0].surface,'星街すいせい');
 assert.throws(()=>context.FuriPopDictionary.normalize([{word:'名前',reading:'abc'}]));
 assert.throws(()=>context.FuriPopDictionary.normalize([{word:'名前',reading:'なまえ'},{word:'名前',reading:'めい'}]));
 assert.throws(()=>context.FuriPopDictionary.normalize(Array.from({length:101},(_,i)=>({word:'名'+i,reading:'な'}))));
 assert.throws(()=>context.FuriPopDictionary.normalize(Array.from({length:40},(_,i)=>({word:'名'.repeat(70)+i,reading:'な'.repeat(110)}))));
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/tinyld/tinyld.light.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'content/language.js'),'utf8'),context);
 const {isJapanese,glyphBounds}=context.FuriPopLanguage;
 assert.equal(isJapanese('今天去學校','zh-TW'),false);
 assert.equal(isJapanese('今天看すいせい直播','zh'),false);
 assert.equal(isJapanese('今日学校',''),false);
 assert.equal(isJapanese('今日学校','ja'),true);
 assert.equal(isJapanese('今日は学校へ行く',''),true);
 assert.equal(isJapanese('今日は学校へ行く','en'),true);
 const chineseWithQuote='24（+2）歲，曾經是個學生。\n目前，好想在求職路上進行王道征途。有什麼問題嗎？\n「這個一定有（*やりますねぇ）」\n壓力也Max捏……哈哈，嗚嗚嗚……';
 for(const language of ['','ja','zh-TW'])assert.equal(isJapanese(chineseWithQuote,language),false);
 assert.equal(isJapanese('「這個一定有（*やりますねぇ）」','ja'),false);
 for(const sentence of ['素直になれない先輩、私嫌いじゃないですよ。','私は日本語を勉強しています。','新しい動画を公開しました！','一色いろは先輩が好きです。','中国語を勉強しています。','日本語の「沒有」は中国語です。']){
  assert.equal(isJapanese(sentence,''),true,sentence);
  assert.equal(isJapanese(sentence,'ja'),true,sentence);
 }
 assert.equal(glyphBounds('𠮷田',0).end,2);
 assert.equal(glyphBounds('𠮷田',1).start,0);
 assert.equal(glyphBounds('𠮷󠄀田',1).end,4);
 assert.equal(glyphBounds('𠮷󠄀田',3).start,0);
 assert.equal(glyphBounds('𠮷󠄀田',4).start,4);
 for(const file of ['content/language.js','engine/dictionary.js','options/options.js','background.js','engine/offscreen.js','content/content.js','popup/popup.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
 console.log('PASS: local tokenizer, full sentences, inflections, overrides, whitespace, astral characters, unknown words, custom names, longest match, live edit/delete, validation, language gating, rare-character hit testing, cache and syntax');
})().catch(e=>{console.error(e);process.exitCode=1;});

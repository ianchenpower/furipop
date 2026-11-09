// Deterministic property checks for the real tokenizer worker.
// Run with Node.js 18+: node tests/tokenizer-properties.cjs
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
context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,'engine',file),'utf8'),context,{filename:file});};
vm.runInContext(fs.readFileSync(path.join(root,'engine/worker.js'),'utf8'),context,{filename:'engine/worker.js'});
let nextId=0;
async function tokenize(text,dictionary){
 const before=messages.length,id=nextId++;
 context.onmessage({data:{id,text,dictionary}});
 await vm.runInContext('queue',context);
 const message=messages[before];
 assert.equal(message.id,id);
 assert.ok(!message.error,`Worker error for ${JSON.stringify(text)}: ${message.error}`);
 return message.tokens;
}
function assertStructure(text,tokens,label){
 assert.ok(Array.isArray(tokens),`${label}: tokens array`);
 assert.equal(tokens.map(t=>t.surface).join(''),text,`${label}: exact reconstruction`);
 let offset=0;
 for(const [i,t] of tokens.entries()){
  assert.equal(t.start,offset,`${label}: token ${i} begins at previous end`);
  assert.ok(t.end>t.start,`${label}: token ${i} has positive span`);
  assert.equal(t.end-t.start,t.surface.length,`${label}: UTF-16 span length`);
  assert.equal(text.slice(t.start,t.end),t.surface,`${label}: UTF-16 slice matches`);
  offset=t.end;
 }
 assert.equal(offset,text.length,`${label}: tokens cover UTF-16 input length`);
}

(async()=>{
 let cases=0;
 // Deterministic cross product, deliberately mixing astral symbols, line breaks,
 // combining sequences, variation selectors, rare Han, kana, punctuation and spaces.
 const heads=['今日は','𠮷野家','麤龘靐','ひらがな','カタカナ','推し活',''];
 const middles=['📚','👩‍💻','𠮷󠄀','か\u3099','\n','\r\n','\t','、','中文','🙂\n🧪',''];
 const tails=['学校へ行く。','動画を見ます！','𠮷田さん','麤龘靐','\n終わり','！','  ',''];
 for(let i=0;i<168;i++){
  const text=heads[i%heads.length]+middles[(i*7+Math.floor(i/heads.length))%middles.length]+tails[(i*11+Math.floor(i/7))%tails.length];
  const tokens=await tokenize(text,[]);
  assertStructure(text,tokens,`generated case ${i}: ${JSON.stringify(text)}`);
  cases++;
 }
 // Ensure explicitly named Unicode edge examples cannot disappear from the corpus.
 for(const text of ['😀','𠮷','𠮷󠄀','か\u3099','\n\r\n\t','麤龘靐','👨‍👩‍👧‍👦','A😀B\nC']){
  assertStructure(text,await tokenize(text,[]),`edge ${JSON.stringify(text)}`);cases++;
 }
 // Longest custom match, live add/change/remove and cache invalidation on identical input.
 const sample='星街すいせいを見る';
 const added=[{word:'星街',reading:'ほしまち'},{word:'星街すいせい',reading:'ホシマチスイセイ'}];
 let tokens=await tokenize(sample,added);assertStructure(sample,tokens,'custom add');cases++;
 assert.equal(tokens[0].surface,'星街すいせい');assert.equal(tokens[0].reading,'ほしまちすいせい');
 const changed=[{word:'星街すいせい',reading:'すいせい'}];
 tokens=await tokenize(sample,changed);assertStructure(sample,tokens,'custom change');cases++;
 assert.equal(tokens[0].surface,'星街すいせい');assert.equal(tokens[0].reading,'すいせい');
 tokens=await tokenize(sample,[]);assertStructure(sample,tokens,'custom delete');cases++;
 assert.notEqual(tokens[0].surface,'星街すいせい');
 // Re-add then delete proves cache state cannot resurrect a stale custom analysis.
 tokens=await tokenize(sample,[{word:'星街すいせい',reading:'ほしまちすいせい'}]);assert.equal(tokens[0].reading,'ほしまちすいせい');cases++;
 tokens=await tokenize(sample,[]);assert.notEqual(tokens[0].surface,'星街すいせい');cases++;
 console.log(`PASS: ${cases} deterministic tokenizer property cases; exact surfaces and UTF-16 offsets verified; custom longest match/add/change/delete cache behavior verified.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

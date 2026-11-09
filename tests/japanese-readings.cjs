// Curated common reading examples; not a corpus accuracy benchmark.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),responses=[];
const ctx=vm.createContext({TextEncoder,console,setTimeout,clearTimeout,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,XMLHttpRequest:class{open(method,url){this.url=url;}send(){fs.readFile(path.resolve(root,'engine',this.url),(error,b)=>{if(error)return this.onerror(error);this.status=200;this.response=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);this.onload();});}}});
ctx.self=ctx;ctx.postMessage=m=>responses.push(m);ctx.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.resolve(root,'engine',f),'utf8'),ctx));
vm.runInContext(fs.readFileSync(path.join(root,'engine/worker.js'),'utf8'),ctx);
const examples=[["今日は図書館で本を読みました。","きょうはとしょかんでほんをよみました。"],["食べる。食べた。食べない。","たべる。たべた。たべない。"],["走っています。走りました。","はしっています。はしりました。"],["私は日本語を勉強します。","わたしはにほんごをべんきょうします。"],["昨日、学校へ行った。","きのう、がっこうへいった。"],["明日は雨が降るでしょう。","あしたはあめがふるでしょう。"],["大きな犬と小さな猫。","おおきないぬとちいさなねこ。"],["生きることは大切だ。","いきることはたいせつだ。"],["先生に聞く。音楽を聞く。","せんせいにきく。おんがくをきく。"],["彼は人気がある。人が多い。","かれはにんきがある。ひとがおおい。"],["一日に一回読む。","いちにちにいっかいよむ。"],["上手に泳ぐ。上に置く。","じょうずにおよぐ。うえにおく。"],["下を見る。地下鉄に乗る。","したをみる。ちかてつにのる。"],["昨日、橋を渡った。","きのう、はしをわたった。"],["山田さんは東京に住んでいる。","やまださんはとうきょうにすんでいる。"],["お母さんとお父さん。","おかあさんとおとうさん。"],["新しい動画を公開しました。","あたらしいどうがをこうかいしました。"],["野獸先輩と神絵師の配信を見る。","やじゅうせんぱいとかみえしのはいしんをみる。"],
 // Context contrasts for common polyphonic kanji, plus stable Japanese name readings.
["生徒は生ビールを飲み、生きて帰った。","せいとはなまびーるをのみ、いきてかえった。"],
["一人で読んだ本を二人で読む。","ひとりでよんだほんをふたりでよむ。"],
["今日のニュースを今日中に読む。","きょうのニュースをきょうじゅうによむ。"],
["上手な人が坂を上がる。","じょうずなひとがさかをあがる。"],
["田中さんは東京で働き、佐藤さんは京都に住む。","たなかさんはとうきょうではたらき、さとうさんはきょうとにすむ。"],
["星街すいせいの配信を見る。","ほしまちすいせいのはいしんをみる。"],
["今日はライブ配信を見る，明日はアーカイブを見る。","きょうはライブはいしんをみる，あしたはアーカイブをみる。"],
["麤龘靐","麤龘靐"]];
(async()=>{
 examples.unshift(['私に蠢く獣','わたしにうごめくけもの']);
 for(const [id,[text]] of examples.entries())ctx.onmessage({data:{id,text}});
 await vm.runInContext('queue',ctx);assert.equal(responses.length,examples.length);
 for(const {id,tokens,error} of responses){assert.ok(!error,error);const [text,expected]=examples[id];assert.equal(tokens.map(t=>t.surface).join(''),text);assert.equal(tokens.map(t=>t.reading||t.surface).join(''),expected,text);for(const t of tokens)assert.equal(text.slice(t.start,t.end),t.surface);}
 const unknown=responses.at(-1);assert.ok(unknown.tokens.every(t=>t.unknown));
 console.log('PASS: '+examples.length+' curated reading/inflection/name/polyphony examples, unknown fallback and UTF-16 offsets');
})().catch(e=>{console.error(e);process.exitCode=1;});

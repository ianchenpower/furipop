// Exploratory engine benchmark. Review disagreements before changing the dictionary.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const baseline = [
 ['多音字', '漁師が朝の市場で魚を売る。', '市場', 'いちば'],
 ['多音字', '株式市場が急落した。', '市場', 'しじょう'],
 ['多音字', '人気のない夜道を歩く。', '人気', 'ひとけ'],
 ['多音字', '人気の映画を見に行った。', '人気', 'にんき'],
 ['多音字', '窓から日が差して眩しい。', '日', 'ひ'],
 ['多音字', '三日で読み終えた。', '三日', 'みっか'],
 ['多音字', '工場で部品を作る。', '工場', 'こうじょう'],
 ['多音字', '町工場で働いている。', '町工場', 'まちこうば'],
 ['多音字', '家の前を散歩する。', '前', 'まえ'],
 ['多音字', '山の奥から獣の声がする。', '獣', 'けもの'],
 ['人名', '鈴木さんに連絡した。', '鈴木', 'すずき'],
 ['人名', '渡辺さんから連絡が来た。', '渡辺', 'わたなべ'],
 ['人名', '小林さんを紹介します。', '小林', 'こばやし'],
 ['人名', '夏目漱石の小説を読む。', '漱石', 'そうせき'],
 ['人名', '芥川龍之介の作品を読む。', '芥川', 'あくたがわ'],
 ['人名', '紫式部について学ぶ。', '紫式部', 'むらさきしきぶ'],
 ['混合日文段', '我今天看了直播。「明日の予定を聞いた」', '予定', 'よてい'],
 ['混合日文段', '真的很好吃！「魚を焼きました」', '焼き', 'やき'],
 ['混合日文段', '這段我看不懂。「電車が遅れました」', '電車', 'でんしゃ'],
 ['混合日文段', '先傳訊息給我。「駅で会いましょう」', '駅', 'えき'],
 ['混合日文段', '我現在在家。「窓を開けました」', '窓', 'まど'],
 ['混合日文段', '這個週末有空嗎？「映画に行きませんか」', '映画', 'えいが'],
];
// Expected readings are fixed independently of the tokenizer output.
const holdout = [
 ['異體姓氏', '髙橋さんに資料を渡した。', '髙橋', 'たかはし'],
 ['異體姓氏', '山﨑さんから返事が来た。', '山﨑', 'やまざき', 'やまさき'],
 ['異體姓氏', '𠮷田さんと駅で待ち合わせた。', '𠮷田', 'よしだ'],
 ['異體姓氏', '渡邊さんに相談した。', '渡邊', 'わたなべ'],
 ['異體姓氏', '齋藤さんが案内してくれた。', '齋藤', 'さいとう'],
 ['對照姓氏', '高橋さんに資料を渡した。', '高橋', 'たかはし'],
 ['對照姓氏', '山崎さんから返事が来た。', '山崎', 'やまざき', 'やまさき'],
 ['對照姓氏', '吉田さんと駅で待ち合わせた。', '吉田', 'よしだ'],
 ['對照姓氏', '渡辺さんに相談した。', '渡辺', 'わたなべ'],
 ['對照姓氏', '斉藤さんが案内してくれた。', '斉藤', 'さいとう'],
 ['多音字', '生の魚は冷蔵庫に入れた。', '生', 'なま'],
 ['多音字', '水を一口飲んだ。', '一口', 'ひとくち'],
 ['多音字', '一昨日から暑くなった。', '一昨日', 'おととい', 'おとつい', 'いっさくじつ'],
 ['多音字', '半月ほど実家に帰っていた。', '半月', 'はんつき', 'はんげつ'],
 ['多音字', '空の瓶を箱に入れた。', '空', 'から'],
 ['多音字', '空を見上げると星が見えた。', '空', 'そら'],
];
// Live CC excerpts captured before running the engine, with expected readings
// assigned from the surrounding phrase. These are two small convenience samples.
const live = [
 ['bBkRwQ6aS8U@57', 'やっていこうと思いますので', '思います', 'おもいます'],
 ['bBkRwQ6aS8U@57', '委員の皆様におかれましても', '委員', 'いいん'],
 ['bBkRwQ6aS8U@57', '委員の皆様におかれましても', '皆様', 'みなさま'],
 ['bBkRwQ6aS8U@59', '非常にこう重要な問題で', '非常', 'ひじょう'],
 ['bBkRwQ6aS8U@59', '非常にこう重要な問題で', '重要', 'じゅうよう'],
 ['bBkRwQ6aS8U@59', '非常にこう重要な問題で', '問題', 'もんだい'],
 ['bBkRwQ6aS8U@61', '政府でも共有しないといけない', '政府', 'せいふ'],
 ['bBkRwQ6aS8U@61', '政府でも共有しないといけない', '共有', 'きょうゆう'],
 ['bBkRwQ6aS8U@63', '私質問趣意書', '質問', 'しつもん'],
 ['bBkRwQ6aS8U@63', '私質問趣意書', '趣意書', 'しゅいしょ'],
 ['SmxSCZzV7j0@93', '自然じゃない', '自然', 'しぜん'],
 ['SmxSCZzV7j0@93', '不自然な日本語でも全然大丈夫だよ', '不自然', 'ふしぜん'],
 ['SmxSCZzV7j0@93', '不自然な日本語でも全然大丈夫だよ', '日本語', 'にほんご'],
 ['SmxSCZzV7j0@93', '不自然な日本語でも全然大丈夫だよ', '全然', 'ぜんぜん'],
 ['SmxSCZzV7j0@93', '不自然な日本語でも全然大丈夫だよ', '大丈夫', 'だいじょうぶ'],
 ['SmxSCZzV7j0@95', '日本語は恥ずかしくない', '恥ずかしく', 'はずかしく'],
 ['SmxSCZzV7j0@99', 'まずみんなに伝えたいなと思っています', '伝え', 'つたえ'],
];
const rows = process.argv?.includes('--live') ? live : process.argv?.includes('--holdout') ? holdout : baseline;
const responses = [];
const ctx = vm.createContext({
 TextEncoder, console, setTimeout, clearTimeout,
 XMLHttpRequest: class {
  open(method, url) { this.url = url; }
  send() {
   fs.readFile(path.resolve(root, 'engine', this.url), (error, bytes) => {
    if (error) return this.onerror(error);
    this.status = 200;
    this.response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    this.onload();
   });
  }
 }
});
ctx.self = ctx;
ctx.postMessage = message => responses.push(message);
ctx.importScripts = (...files) => files.forEach(file =>
 vm.runInContext(fs.readFileSync(path.join(root, 'engine', file), 'utf8'), ctx));
vm.runInContext(fs.readFileSync(path.join(root, 'engine/worker.js'), 'utf8'), ctx);

(async () => {
 rows.forEach(([, text], id) => ctx.onmessage({data: {id, text}}));
 await vm.runInContext('queue', ctx);
 if (responses.length !== rows.length) throw new Error('Incomplete worker responses');
 const cases = responses.map(({id, tokens, error}) => {
  if (error) throw new Error(error);
  const [group, text, target, expected, ...variants] = rows[id];
  const start = text.indexOf(target), end = start + target.length;
  const overlap = tokens.filter(t => t.start < end && t.end > start);
  const aligned = overlap[0]?.start === start && overlap.at(-1)?.end === end;
  const observed = aligned ? overlap.map(t => t.reading || t.surface).join('') : null;
  const status = !aligned ? 'boundary' : /\p{Script=Han}/u.test(observed)
   ? 'missing' : [expected, ...variants].includes(observed) ? 'match' : 'different';
  return {group, text, target, expected, variants, observed, status, tokens: overlap};
 });
 console.log(JSON.stringify(cases, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });

// Expanded language heuristic corpus. Run with Node.js 18+.
// Product contract is intentionally narrow; exploration is reported, not scored as gold.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({Intl});
for(const file of ['vendor/tinyld/tinyld.light.js','content/language.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const {isJapanese}=context.FuriPopLanguage;

// Contract cases below are narrowly grounded in README v0.2.5 and language.js:
// zh/ko tags suppress; kana is a hint; tagged single-line Han headings <=12 Han trust ja;
// untagged Han-only text stays off. They do not claim general language classification.
const rules=[];
const add=(category,text,lang,expected)=>rules.push({category,text,lang,expected});
const jpKana=[
 '今日は晴れです。','図書館へ行きます。','新しい本を読みました。','すいせいの配信を見る。',
 '学校で友達に会った。','猫が窓辺で眠っている。','明日は映画を見に行く。','日本語を勉強しています。',
 'この料理はおいしいですね。','駅前で待ち合わせしよう。','雨が降ったので傘を持つ。','好きな音楽を聞いています。',
 '昨日は早く寝ました。','桜がきれいに咲いている。','ゲームの続きを始めよう。','電車が少し遅れています。',
 '本当にありがとうございます。','今日は何を食べますか。','海辺をゆっくり歩いた。','新作アニメが楽しみです。'
];
for(const s of jpKana) add('kana-ja-hint',s,'',true);
const zhSamples=['今天去學校','我喜歡看動畫','明天一起吃飯嗎','這本書非常有趣','最近工作很忙','週末想去旅行','天氣變冷了要穿外套','今天晚上看電影','謝謝你的幫忙','我正在學習日文'];
for(const s of zhSamples){ add('zh-tag-suppression',s,'zh-TW',false); add('ko-tag-suppression',s,'ko-KR',false); }
const headings=['高校生活','今日学校','春夏秋冬','東京物語','新世界紀行','青春時代','世界文学','文化祭','山田太郎','猫日記','月刊少年誌','電車旅行','日本語学習','花鳥風月'];
for(const s of headings) add('ja-tag-short-han-heading',s,'ja',true);
const untaggedHan=['高校生活','今日学校','明日晴天','世界和平','東京旅行','春夏秋冬','山田太郎','文化祭','新世界紀行','青春時代'];
for(const s of untaggedHan) add('untagged-han-conservative',s,'',false);
// Exact language-tag invariance is a contract even for otherwise ambiguous input.
for(const s of ['漢字だけの文章','今天去學校','東京生活','今日学校']) add('zh-tag-always-suppress',s,'zh',false);

// Product acknowledges these as difficult: mixed Chinese/Japanese, short Han names,
// mis-tagged Chinese headings, dialect/orthography, and language model boundary behavior.
// We record outcomes for review and never turn a subjective label into a failure.
const explorations=[];
const explore=(category,text,lang='')=>explorations.push({category,text,lang});
for(const s of [
 '今天看すいせい直播','我今天去東京看演唱會','這個動畫真的很面白い','日本語を勉強中，真的很有趣',
 '「今日は晴れです」但我還是想待在家','喜歡這首歌的歌詞和メロディ','週末去東京旅行，期待新幹線','我覺得這個角色好可愛い',
 '你好，今日は元気？','生日快樂、お誕生日おめでとう','動漫很好看，続きが気になる','這個一定有（やりますねぇ）',
 '漢字短標題','行き','今日','明日','大丈夫','一生懸命','重慶森林','東京愛情故事','小明今天去学校',
 '日文混合English與中文','配信お疲れ様！今天很開心','請問「ありがとう」怎麼念？','春の新番組，大家有推薦嗎？',
 '今日は図書館へ行く。','日本語の「沒有」は中国語です。','素直になれない先輩、私嫌いじゃないですよ。',
 '動漫新作《春日物語》正式上映','今天天氣很冷，風が強いね。'
]) explore('mixed-or-ambiguous',s);
for(const s of ['京都案内','物語世界','新刊情報','春風日記']) explore('ja-tag-possibly-wrong-short-han',s,'ja');

const keys=new Set();
for(const x of rules.concat(explorations)){
 const k=JSON.stringify([x.text,x.lang]);
 assert(!keys.has(k),'duplicate corpus input: '+k); keys.add(k);
}
let failures=[];
for(const c of rules){
 const actual=isJapanese(c.text,c.lang);
 if(actual!==c.expected) failures.push({category:c.category,text:c.text,lang:c.lang,expected:c.expected,actual});
}
// Metamorphic checks: whitespace trim and repeated-call/cache stability where README defines trim/cache behavior.
const invariants=[];
for(const s of ['高校生活','今日学校','今日は晴れです。','図書館へ行きます。']){
 invariants.push({kind:'trim',text:s,base:isJapanese(s,'ja'),padded:isJapanese('  '+s+'\n','ja')});
}
for(const s of ['今天去學校','漢字だけの文章']) invariants.push({kind:'zh-tag-stability',text:s,first:isJapanese(s,'zh-TW'),repeat:isJapanese(s,'zh-TW')});
const invariantFailures=invariants.filter(x=>x.kind==='trim'?x.base!==x.padded:x.first!==x.repeat);
let observed={};
for(const c of explorations){ const actual=isJapanese(c.text,c.lang); (observed[c.category]??=[]).push({text:c.text,lang:c.lang,actual}); }
console.log(JSON.stringify({ruleCases:rules.length,ruleFailures:failures,ruleFailureCount:failures.length,invariantChecks:invariants.length,invariantFailures,explorationCases:explorations.length,observations:observed},null,2));
if(failures.length||invariantFailures.length) process.exitCode=1;



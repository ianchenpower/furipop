// Run with Node.js 18+: node tests/language.cjs. No npm install needed.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({Intl});
for(const file of ['vendor/tinyld/tinyld.light.js','content/language.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const {isJapanese}=context.FuriPopLanguage;
const chineseQuote='24（+2）歲，曾經是個學生。\n目前，好想在求職路上進行王道征途。有什麼問題嗎？\n「這個一定有（*やりますねぇ）」\n壓力也Max捏……哈哈，嗚嗚嗚……';
const cases=[
 ['高校生活','ja',true],['高校生活！','ja',true],['高校生活','ja-JP',true],['  高校生活\n','ja',true],['高校\n生活','ja',false],
 ['高校生活','',false],['高校生活','zh-TW',false],
 ['今日学校','ja',true],['今日学校','',false],
 ['今日は図書館へ行く。','',true],['今日は図書館へ行く。','ja',true],
 ['素直になれない先輩、私嫌いじゃないですよ。','ja',true],
 ['一色いろは先輩が好きです。','ja',true],
 ['日本語の「沒有」は中国語です。','ja',true],
 ['下班後去超市買了牛奶、雞蛋和水果。','ja',false],
 ['東京都教育委員会発表新年度学校教育方針','ja',true],
 ['東京都立大学大学院人文科学研究科入学式','ja',false],
 ['今天去學校','zh-TW',false],['今天看すいせい直播','zh',false],
 [chineseQuote,'',false],[chineseQuote,'ja',false],[chineseQuote,'zh-TW',false],
 ['「這個一定有（*やりますねぇ）」','ja',false]
];
for(const [text,lang,expected] of cases)assert.equal(isJapanese(text,lang),expected,JSON.stringify({text,lang}));
// Repeating a decision exercises the bounded decision cache too.
assert.equal(isJapanese('高校生活','ja'),true);
assert.equal(isJapanese(chineseQuote,'ja'),false);
console.log('PASS: '+cases.length+' language cases, explicit Japanese headings, ambiguous Han suppression, mixed Chinese quote suppression and cache');

importScripts('../vendor/kuromoji/kuromoji.js','overrides.js','dictionary.js');
let ready;
const cache=new Map();
const han=/[\p{Script=Han}々〆ヶ]/u;
// Only curated proper nouns/slang override contextual dictionary readings.
const overrides=Object.fromEntries(Object.entries(self.FURIPOP_OVERRIDES).filter(([s])=>['一回','今日中','星街すいせい','野獣先輩','野獸先輩','神絵師','神畫師','絵師','畫師','画師','鍵垢','本垢','裏垢','推し','神回','學校','應援','發售','預約'].includes(s)));
// Match known spelling variants as whole surnames and keep the original glyphs.
Object.assign(overrides,{'髙橋':'たかはし','山﨑':'やまざき','𠮷田':'よしだ'});
let activeOverrides=overrides;
let customKeys=new Set();
let keys=Object.keys(overrides).sort((a,b)=>b.length-a.length);
let dictionaryKey='[]';
function configure(entries=[]){
 const normalized=FuriPopDictionary.normalize(entries);const next=JSON.stringify(normalized);
 if(next===dictionaryKey)return;
 dictionaryKey=next;cache.clear();
 customKeys=new Set(normalized.map(e=>e.word));
 activeOverrides={...overrides,...Object.fromEntries(normalized.map(e=>[e.word,e.reading]))};
 keys=Object.keys(activeOverrides).sort((a,b)=>b.length-a.length);
}

const hira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function getTokenizer(){return ready ||= new Promise((resolve,reject)=>kuromoji.builder({dicPath:'../vendor/kuromoji/dict/'}).build((e,t)=>e?reject(e):resolve(t))).catch(e=>{ready=null;throw e;});}
async function analyze(text){
 if(cache.has(text)){const value=cache.get(text);cache.delete(text);cache.set(text,value);return value;}
 const tokenizer=await getTokenizer();const result=[];let cursor=0;
 function segment(s,base){let offset=0;for(const t of tokenizer.tokenize(s)){const surface=t.surface_form;const start=s.indexOf(surface,offset);if(start<0)continue;if(start>offset)result.push({surface:s.slice(offset,start),start:base+offset,end:base+start});const reading=t.reading && t.reading!=='*'?hira(t.reading):null;result.push({surface,start:base+start,end:base+start+surface.length,reading:han.test(surface)?reading:null,unknown:han.test(surface)&&!reading});offset=start+surface.length;}if(offset<s.length)result.push({surface:s.slice(offset),start:base+offset,end:base+s.length});}
 while(cursor<text.length){let at=text.length,key=null;const customStarts=[...customKeys].map(k=>text.indexOf(k,cursor)).filter(n=>n>=0);for(const k of keys){const n=text.indexOf(k,cursor);if(n<0)continue;if(!customKeys.has(k)&&customStarts.some(c=>c>n&&c<n+k.length))continue;if(n<at||(n===at&&customKeys.has(k)&&!customKeys.has(key))){at=n;key=k;}}if(at>cursor)segment(text.slice(cursor,at),cursor);if(!key)break;result.push({surface:key,start:at,end:at+key.length,reading:activeOverrides[key],custom:customKeys.has(key)});cursor=at+key.length;}
 for(const token of result){
  if(token.custom)continue;
  const following=text.slice(token.end,token.end+16);
  if(token.surface==='獣'&&(text.slice(Math.max(0,token.start-2),token.start)==='蠢く'||/^の(?:声|足跡|群れ)/u.test(following)))token.reading='けもの';
  if(token.surface==='市場'&&/^で魚を(?:売|買|仕入)/u.test(following))token.reading='いちば';
  if(token.surface==='人気'&&/^のない(?:夜道|路地|通り|街角)/u.test(following))token.reading='ひとけ';
  if(token.surface==='空'&&/^の(?:瓶|びん|容器|コップ|ペットボトル)/u.test(following))token.reading='から';
 }
 for(const token of result){if(!token.custom&&token.surface==='鏡'&&text.slice(token.end,token.end+2)==='で見')token.reading='かがみ';}
 for(const token of result){if(!token.custom&&token.surface==='方'&&text.slice(Math.max(0,token.start-4),token.start)==='視聴者の')token.reading='かた';}
 for(let i=0;i+1<result.length;i++){
  const first=result[i],second=result[i+1];
  if(first.custom||second.custom||first.end!==second.start)continue;
  const surface=first.surface+second.surface;
  let reading;
  if(surface==='町工場')reading='まちこうば';
  if(surface==='一口'&&/^(?:だけ|ずつ)?(?:食べ|飲|味見)/u.test(text.slice(second.end,second.end+8)))reading='ひとくち';
  if(surface==='三日'){
   // An isolated day count or date uses みっか, but 十三日 does not.
   const before=text.slice(Math.max(0,first.start-1),first.start);
   const after=text.slice(second.end,second.end+1);
   if(!/[0-9０-９〇零一二三四五六七八九十百千万億兆]/u.test(before)&&after!=='月')reading='みっか';
  }
  if(reading)result.splice(i,2,{surface,start:first.start,end:second.end,reading});
 }
 for(let i=0;i+1<result.length;i++){const a=result[i],b=result[i+1];if(!a.custom&&!b.custom&&['一','二','1','2','１','２'].includes(a.surface)&&b.surface==='人'&&a.end===b.start&&/^[でにがはともを]$/u.test(text.slice(b.end,b.end+1))){result.splice(i,2,{surface:a.surface+'人',start:a.start,end:b.end,reading:['一','1','１'].includes(a.surface)?'ひとり':'ふたり'});}}
 cache.set(text,result);if(cache.size>300)cache.delete(cache.keys().next().value);return result;
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{try{configure(data.dictionary);self.postMessage({id:data.id,tokens:await analyze(data.text)});}catch(e){self.postMessage({id:data.id,error:e.message});}});};

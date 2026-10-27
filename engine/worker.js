importScripts('../vendor/kuromoji/kuromoji.js','overrides.js','dictionary.js');
let ready;
const cache=new Map();
const han=/[\p{Script=Han}々〆ヶ]/u;
// Only curated proper nouns/slang override contextual dictionary readings.
const overrides=Object.fromEntries(Object.entries(self.FURIPOP_OVERRIDES).filter(([s])=>['野獣先輩','野獸先輩','神絵師','神畫師','絵師','畫師','画師','鍵垢','本垢','裏垢','推し','神回','學校','應援','發售','預約'].includes(s)));
let activeOverrides=overrides;
let keys=Object.keys(overrides).sort((a,b)=>b.length-a.length);
let dictionaryKey='[]';
function configure(entries=[]){
 const normalized=FuriPopDictionary.normalize(entries);const next=JSON.stringify(normalized);
 if(next===dictionaryKey)return;
 dictionaryKey=next;cache.clear();
 activeOverrides={...overrides,...Object.fromEntries(normalized.map(e=>[e.word,e.reading]))};
 keys=Object.keys(activeOverrides).sort((a,b)=>b.length-a.length);
}

const hira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function getTokenizer(){return ready ||= new Promise((resolve,reject)=>kuromoji.builder({dicPath:'../vendor/kuromoji/dict/'}).build((e,t)=>e?reject(e):resolve(t))).catch(e=>{ready=null;throw e;});}
async function analyze(text){
 if(cache.has(text)){const value=cache.get(text);cache.delete(text);cache.set(text,value);return value;}
 const tokenizer=await getTokenizer();const result=[];let cursor=0;
 function segment(s,base){let offset=0;for(const t of tokenizer.tokenize(s)){const surface=t.surface_form;const start=s.indexOf(surface,offset);if(start<0)continue;if(start>offset)result.push({surface:s.slice(offset,start),start:base+offset,end:base+start});const reading=t.reading && t.reading!=='*'?hira(t.reading):null;result.push({surface,start:base+start,end:base+start+surface.length,reading:han.test(surface)?reading:null,unknown:han.test(surface)&&!reading});offset=start+surface.length;}if(offset<s.length)result.push({surface:s.slice(offset),start:base+offset,end:base+s.length});}
 while(cursor<text.length){let at=text.length,key=null;for(const k of keys){const n=text.indexOf(k,cursor);if(n>=0&&n<at){at=n;key=k;}}if(at>cursor)segment(text.slice(cursor,at),cursor);if(!key)break;result.push({surface:key,start:at,end:at+key.length,reading:activeOverrides[key],custom:!Object.hasOwn(overrides,key)||activeOverrides[key]!==overrides[key]});cursor=at+key.length;}
 cache.set(text,result);if(cache.size>300)cache.delete(cache.keys().next().value);return result;
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{try{configure(data.dictionary);self.postMessage({id:data.id,tokens:await analyze(data.text)});}catch(e){self.postMessage({id:data.id,error:e.message});}});};

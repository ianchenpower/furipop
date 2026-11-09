// Run with Node.js 18+: node tests/options.cjs. No browser or npm install needed.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
async function boot(initial,failSave=false){
 const elements=new Map();
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,listener){this.listeners[name]=listener;}
  focus(){this.focused=true;}
  reset(){elements.get('word').value='';elements.get('reading').value='';}
 }
 for(const id of ['dictionary-form','word','reading','status','save','cancel-edit','entries','count','empty','table'])elements.set(id,new Element(id));
 let stored=JSON.parse(JSON.stringify(initial)),writes=0,changed;
 const context=vm.createContext({TextEncoder,console,document:{getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},chrome:{storage:{sync:{get:async()=>({furipopDictionary:stored}),set:async value=>{if(failSave)throw new Error('sync quota exceeded');stored=JSON.parse(JSON.stringify(value.furipopDictionary));writes++;changed?.({furipopDictionary:{newValue:stored}},'sync');}},onChanged:{addListener:fn=>{changed=fn;}}}}});
 context.self=context;
 for(const file of ['engine/dictionary.js','options/options.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 await Promise.resolve();await Promise.resolve();
 function button(word,label){const row=elements.get('entries').children.find(row=>row.children[0].textContent===word);assert.ok(row,'Missing row '+word);return row.children[2].children.find(b=>b.textContent===label);}
 return {elements,button,get stored(){return stored;},get writes(){return writes;},submit:async(word,reading)=>{elements.get('word').value=word;elements.get('reading').value=reading;await elements.get('dictionary-form').listeners.submit({preventDefault(){}});},change:async(next)=>{stored=JSON.parse(JSON.stringify(next));changed({furipopDictionary:{newValue:stored}},'sync');await Promise.resolve();}};
}
(async()=>{
 const original=[{word:'星街すいせい',reading:'ほしまちすいせい'},{word:'学校',reading:'がっこう'}];
 let h=await boot(original);
 h.button('星街すいせい','編輯').onclick();await h.submit('星街','ホシマチ');
 assert.deepEqual(h.stored,[{word:'星街',reading:'ほしまち'},{word:'学校',reading:'がっこう'}],'Rename replaces the original entry and preserves others');
 assert.equal(h.elements.get('word').value,'');
 h.button('星街','編輯').onclick();await h.submit('学校','がくこう');
 assert.equal(h.writes,1,'Collision must not persist');
 assert.deepEqual(h.stored,[{word:'星街',reading:'ほしまち'},{word:'学校',reading:'がっこう'}]);
 assert.match(h.elements.get('status').textContent,/已有|已存在/);
 assert.equal(h.elements.get('word').value,'学校','Failed save keeps the user input');
 await h.elements.get('cancel-edit').listeners.click();
 assert.equal(h.elements.get('word').value,'');
 assert.equal(h.elements.get('cancel-edit').hidden,true);
 await h.submit('通知','つうち');
 assert.equal(h.stored.length,3,'Cancel switches back to add mode');
 h.button('通知','編輯').onclick();await h.submit('通知','ツウチ');
 assert.equal(h.stored.length,3,'Reading-only edits replace in place');
 assert.equal(h.stored[2].reading,'つうち');
 h.button('通知','編輯').onclick();await h.submit('通知','abc');
 assert.equal(h.stored[2].reading,'つうち','Validation failure cannot change storage');
 assert.equal(h.elements.get('cancel-edit').hidden,false);
 await h.button('通知','刪除').onclick();
 assert.equal(h.elements.get('cancel-edit').hidden,true,'Deleting edited item exits edit mode');
 assert.equal(h.stored.length,2);
 h=await boot(original);h.button('星街すいせい','編輯').onclick();
 await h.change([{word:'学校',reading:'がっこう'}]);
 await h.submit('星街','ほしまち');
 assert.deepEqual(h.stored,[{word:'学校',reading:'がっこう'}],'A remotely deleted source must not be recreated by rename');
 assert.match(h.elements.get('status').textContent,/削除|刪除|不存在|找不到/);
 h=await boot(Array.from({length:100},(_,i)=>({word:'名'+i,reading:'な'})));
 h.button('名0','編輯').onclick();await h.submit('名前','なまえ');
 assert.equal(h.stored.length,100,'Rename at capacity must not become a 101st entry');
 assert.equal(h.stored[0].word,'名前');
 h=await boot(original,true);h.button('星街すいせい','編輯').onclick();await h.submit('星街','ほしまち');
 assert.deepEqual(h.stored,original,'Failed sync save leaves storage unchanged');
 assert.equal(h.elements.get('word').value,'星街','Failed sync save preserves draft');
 assert.equal(h.elements.get('cancel-edit').hidden,false,'Failed sync save stays in edit mode');
 assert.equal(h.elements.get('save').disabled,false,'Failed sync save releases busy state');
 console.log('PASS: rename, collision prevention, cancel, reading edit, invalid input, delete during edit, remote deletion, capacity and save failures');
})().catch(error=>{console.error(error);process.exitCode=1;});

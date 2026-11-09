'use strict';
let entries=[],loaded=false,busy=false,editingWord=null;
const form=document.getElementById('dictionary-form'),word=document.getElementById('word'),reading=document.getElementById('reading'),status=document.getElementById('status'),save=document.getElementById('save'),cancel=document.getElementById('cancel-edit');
function notify(text){status.textContent=text;}
function finishEditing(){editingWord=null;form.reset();render();}
function editEntry(entry){
 if(busy)return;
 editingWord=entry.word;word.value=entry.word;reading.value=entry.reading;render();reading.focus();
 notify('正在編輯「'+entry.word+'」。修改詞彙名稱會替換原條目。');
}
async function removeEntry(entry){
 if(await persist(entries.filter(e=>e.word!==entry.word),'已刪除「'+entry.word+'」，恢復內建讀音。')){
  if(editingWord===entry.word)finishEditing();
 }
}
function render(){
 const body=document.getElementById('entries');body.replaceChildren();
 document.getElementById('count').textContent=entries.length+' / 100';
 document.getElementById('empty').hidden=entries.length>0;document.getElementById('table').hidden=!entries.length;
 for(const entry of entries){
  const row=document.createElement('tr');
  for(const text of [entry.word,entry.reading]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
  const controls=document.createElement('td');
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='編輯';edit.setAttribute('aria-label','編輯 '+entry.word);edit.onclick=()=>editEntry(entry);
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='刪除';remove.setAttribute('aria-label','刪除 '+entry.word);remove.onclick=()=>removeEntry(entry);
  edit.disabled=remove.disabled=busy;controls.append(edit,remove);row.append(controls);body.append(row);
 }
 save.disabled=!loaded||busy;save.textContent=editingWord===null?'儲存讀音':'儲存修改';
 cancel.hidden=editingWord===null;cancel.disabled=busy;word.disabled=reading.disabled=busy;
}
async function persist(next,message){
 if(!loaded||busy)return false;
 try{const valid=FuriPopDictionary.normalize(next);busy=true;render();await chrome.storage.sync.set({furipopDictionary:valid});entries=valid;notify(message);return true;}
 catch(e){notify('無法儲存：'+e.message);return false;}
 finally{busy=false;render();}
}
cancel.addEventListener('click',()=>{if(busy)return;finishEditing();word.focus();notify('已取消編輯，可新增其他詞彙。');});
form.addEventListener('submit',async e=>{e.preventDefault();if(!loaded||busy)return;
 try{
  const item=FuriPopDictionary.normalize([{word:word.value,reading:reading.value}])[0];
  const next=entries.slice();
  if(editingWord!==null){
   const index=entries.findIndex(entry=>entry.word===editingWord);
   if(index<0)throw new Error('原詞「'+editingWord+'」已被刪除，請取消編輯或重新選擇詞彙。');
   if(entries.some((entry,i)=>i!==index&&entry.word===item.word))throw new Error('詞典中已有「'+item.word+'」，請改用其他名稱或取消後編輯該詞。');
   next[index]=item;
  }else{
   const index=entries.findIndex(entry=>entry.word===item.word);
   if(index<0)next.push(item);else next[index]=item;
  }
  if(await persist(next,'已儲存「'+item.word+'」→ '+item.reading+'。移開滑鼠再懸停即可使用。'))finishEditing();
 }catch(error){notify(error.message);}
});
chrome.storage.sync.get({furipopDictionary:[]}).then(s=>{entries=FuriPopDictionary.normalize(s.furipopDictionary);loaded=true;render();notify('詞典已就緒。');}).catch(e=>notify('無法讀取詞典：'+e.message));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes.furipopDictionary){try{entries=FuriPopDictionary.normalize(changes.furipopDictionary.newValue||[]);render();}catch(e){notify('詞典格式錯誤：'+e.message);}}});

'use strict';
let entries=[],loaded=false,busy=false;
const form=document.getElementById('dictionary-form'),word=document.getElementById('word'),reading=document.getElementById('reading'),status=document.getElementById('status'),save=document.getElementById('save');
function notify(text){status.textContent=text;}
function render(){
 const body=document.getElementById('entries');body.replaceChildren();
 document.getElementById('count').textContent=entries.length+' / 100';
 document.getElementById('empty').hidden=entries.length>0;document.getElementById('table').hidden=!entries.length;
 for(const entry of entries){
  const row=document.createElement('tr');
  for(const text of [entry.word,entry.reading]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
  const controls=document.createElement('td');
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='編輯';edit.setAttribute('aria-label','編輯 '+entry.word);edit.onclick=()=>{word.value=entry.word;reading.value=entry.reading;reading.focus();};
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='刪除';remove.setAttribute('aria-label','刪除 '+entry.word);remove.onclick=()=>persist(entries.filter(e=>e.word!==entry.word),'已刪除「'+entry.word+'」，恢復內建讀音。');
  edit.disabled=remove.disabled=busy;controls.append(edit,remove);row.append(controls);body.append(row);
 }
 save.disabled=!loaded||busy;
}
async function persist(next,message){
 if(!loaded||busy)return false;
 try{const valid=FuriPopDictionary.normalize(next);busy=true;render();await chrome.storage.sync.set({furipopDictionary:valid});entries=valid;notify(message);return true;}
 catch(e){notify('無法儲存：'+e.message);return false;}
 finally{busy=false;render();}
}
form.addEventListener('submit',async e=>{e.preventDefault();
 try{const item=FuriPopDictionary.normalize([{word:word.value,reading:reading.value}])[0];const next=entries.filter(e=>e.word!==item.word);next.push(item);
 if(await persist(next,'已儲存「'+item.word+'」→ '+item.reading+'。移開滑鼠再懸停即可使用。'))form.reset();
 }catch(error){notify(error.message);}
});
chrome.storage.sync.get({furipopDictionary:[]}).then(s=>{entries=FuriPopDictionary.normalize(s.furipopDictionary);loaded=true;render();notify('詞典已就緒。');}).catch(e=>notify('無法讀取詞典：'+e.message));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes.furipopDictionary){try{entries=FuriPopDictionary.normalize(changes.furipopDictionary.newValue||[]);render();}catch(e){notify('詞典格式錯誤：'+e.message);}}});

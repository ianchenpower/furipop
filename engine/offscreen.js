let worker;
let serial=0;
const pending=new Map();
function start() {
  worker=new Worker('worker.js');
  worker.onmessage=({data})=>{const p=pending.get(data.id); if(p){clearTimeout(p.timer);pending.delete(data.id);p.reply(data);}};
  worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reply({error:'讀音引擎載入失敗，請重新載入擴充功能',code:'ENGINE_LOAD_FAILED'});} pending.clear(); worker.terminate();worker=null;};
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(m.type!=='FURIPOP_ENGINE')return;
  if(!worker)start();
  const id=++serial;
  pending.set(id,{reply,timer:setTimeout(()=>{pending.delete(id);reply({error:'讀音引擎逾時，請稍後重試',code:'ENGINE_TIMEOUT'});},60000)});
  worker.postMessage({id,text:m.text,dictionary:m.dictionary});return true;
});
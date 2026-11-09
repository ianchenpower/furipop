let worker;
let serial=0;
const pending=new Map();
const loadFailure={error:'讀音引擎載入失敗，請重新載入擴充功能',code:'ENGINE_LOAD_FAILED'};

function resetWorker(instance,failure){
  // A late callback from a previous generation must never reset the new one.
  if(worker!==instance)return;
  worker=null;
  instance.terminate();
  const replies=[];
  for(const [id,request] of pending){
    if(request.worker!==instance)continue;
    clearTimeout(request.timer);pending.delete(id);replies.push(request.reply);
  }
  // Clear the complete generation before replying, even if a closed port throws.
  for(const reply of replies){try{reply(failure);}catch{}}
}

function start(){
  const instance=new Worker('worker.js');
  worker=instance;
  instance.onmessage=({data})=>{
    if(worker!==instance)return;
    const request=pending.get(data?.id);
    if(!request||request.worker!==instance)return;
    clearTimeout(request.timer);pending.delete(data.id);
    request.reply(data);
  };
  instance.onerror=event=>{event?.preventDefault?.();resetWorker(instance,loadFailure);};
  instance.onmessageerror=()=>resetWorker(instance,loadFailure);
  return instance;
}

chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.type!=='FURIPOP_ENGINE')return;
  let instance;
  try{
    instance=worker||start();
    const id=++serial;
    const timer=setTimeout(()=>resetWorker(instance,{
      error:'讀音引擎逾時，請稍後重試',code:'ENGINE_TIMEOUT'
    }),60000);
    pending.set(id,{reply,timer,worker:instance});
    instance.postMessage({id,text:message.text,dictionary:message.dictionary});
  }catch{
    if(instance)resetWorker(instance,loadFailure);
    else reply(loadFailure);
  }
  return true;
});

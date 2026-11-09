// Run: node tests/offscreen.cjs. No npm dependencies required.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../engine/offscreen.js'),'utf8');
function harness(){
 const workers=[],timers=new Map();let listener,serial=0,failConstruct=false;
 class FakeWorker {
  constructor(){if(failConstruct){failConstruct=false;throw new Error('constructor failed');}this.posts=[];this.terminated=0;workers.push(this);}
  postMessage(data){if(this.failSend)throw new Error('postMessage failed');this.posts.push(data);}
  terminate(){this.terminated++;}
 }
 const context=vm.createContext({Worker:FakeWorker,chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(source,context);
 function send(text='先生'){const replies=[];const keep=listener({type:'FURIPOP_ENGINE',text,dictionary:[]},{},value=>replies.push(value));assert.equal(keep,true);return replies;}
 return {workers,timers,send,failConstructor(){failConstruct=true;}};
}
{
 const h=harness(),a=h.send(),w=h.workers[0];
 w.onmessage({data:{id:w.posts[0].id,tokens:[{surface:'先生',reading:'せんせい'}]}});
 assert.equal(a[0].tokens[0].reading,'せんせい');assert.equal(h.timers.size,0);assert.equal(w.terminated,0);
}
{
 const h=harness(),a=h.send(),b=h.send(),old=h.workers[0];
 const oldMessage=old.onmessage,oldError=old.onerror,oldTimer=[...h.timers.values()][0];
 oldTimer();
 assert.equal(old.terminated,1,'timeout must terminate a hung Worker');
 assert.equal(a[0]?.code,'ENGINE_TIMEOUT');assert.equal(b[0]?.code,'ENGINE_TIMEOUT');assert.equal(h.timers.size,0);
 const next=h.send(),fresh=h.workers[1];assert.ok(fresh,'next request must create a fresh Worker');
 oldMessage({data:{id:fresh.posts[0].id,tokens:[]}});oldError({preventDefault(){}});oldTimer();
 assert.equal(next.length,0,'stale callbacks must not answer a new request');assert.equal(fresh.terminated,0);
 fresh.onmessage({data:{id:fresh.posts[0].id,tokens:[{reading:'せんせい'}]}});
 assert.equal(next[0]?.tokens[0].reading,'せんせい');assert.equal(a.length,1);assert.equal(b.length,1);
}
{
 const h=harness(),a=h.send(),b=h.send(),old=h.workers[0];old.onerror({preventDefault(){}});
 assert.equal(old.terminated,1);assert.equal(a[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(b[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(h.timers.size,0);
 h.send();assert.equal(h.workers.length,2);
}
{
 const h=harness();h.failConstructor();const a=h.send();assert.equal(a[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(h.timers.size,0);
 h.send();assert.equal(h.workers.length,1,'constructor failure must be retryable');
}
{
 const h=harness(),a=h.send(),old=h.workers[0];old.failSend=true;const b=h.send();
 assert.equal(old.terminated,1);assert.equal(a[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(b[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(h.timers.size,0);
 h.send();assert.equal(h.workers.length,2);
}
{
 const h=harness(),a=h.send(),w=h.workers[0];assert.equal(typeof w.onmessageerror,'function');w.onmessageerror();
 assert.equal(a[0]?.code,'ENGINE_LOAD_FAILED');assert.equal(w.terminated,1);assert.equal(h.timers.size,0);
}
console.log('PASS: offscreen normal response, timeout recovery, generation guards, load/message errors, constructor and postMessage failures');

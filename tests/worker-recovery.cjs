// Optional real MV3 fault-injection regression. Requires playwright-core and Edge.
// Run: node tests/worker-recovery.cjs. Set PLAYWRIGHT_CORE_PATH / EDGE_BINARY as needed.
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'work'),{recursive:true});
 const profile=await fs.mkdtemp(path.join(root,'work','worker-recovery-'));
 try{
 const context=await chromium.launchPersistentContext(profile,{
  executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
  args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']
 });
 try{
  const service=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await service.evaluate(async()=>{await chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]});await ensureEngine();});
  const browserCDP=await context.browser().newBrowserCDPSession();
  const targets=await browserCDP.send('Target.getTargets');
  const target=targets.targetInfos.find(t=>t.url.endsWith('/engine/offscreen.html'));
  assert.ok(target,'real offscreen target must exist');
  const {sessionId}=await browserCDP.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let serial=0;const pending=new Map();
  browserCDP.on('Target.receivedMessageFromTarget',event=>{
   if(event.sessionId!==sessionId)return;
   const message=JSON.parse(event.message),request=pending.get(message.id);
   if(!request)return;pending.delete(message.id);
   message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);
  });
  async function offscreen(expression,awaitPromise=false){
   const id=++serial,promise=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
   await browserCDP.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise,returnByValue:true}})});
   const result=await promise;if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
   return result.result.value;
  }
  await offscreen(`globalThis.nativeWorker=Worker;globalThis.nativeTimeout=setTimeout;globalThis.testWorkers=[];globalThis.blockOnce=true;
   globalThis.Worker=class extends nativeWorker {
    constructor(...args){super(...args);testWorkers.push(this);if(blockOnce){blockOnce=false;this.postMessage=()=>{globalThis.staleMessage=this.onmessage;globalThis.staleError=this.onerror;};}}
    terminate(){this.testTerminated=true;super.terminate();}
   };
   globalThis.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay===60000?100:delay,...args);`);
  const page=await context.newPage();
  await page.route('https://x.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body>worker recovery fixture</body>'}));
  await page.goto('https://x.com/worker-recovery');
  const pageCDP=await context.newCDPSession(page),worlds=[];
  pageCDP.on('Runtime.executionContextCreated',event=>worlds.push(event.context));
  await pageCDP.send('Runtime.enable');
  const world=worlds.find(w=>w.origin.startsWith('chrome-extension://'));assert.ok(world,'content script world must exist');
  async function request(){
   const result=await pageCDP.send('Runtime.evaluate',{contextId:world.id,expression:"chrome.runtime.sendMessage({type:'FURIPOP_ANALYZE',text:'先生'})",awaitPromise:true,returnByValue:true});
   assert.ok(!result.exceptionDetails);return result.result.value;
  }
  const first=await request();assert.equal(first.code,'ENGINE_TIMEOUT');
  const firstState=await offscreen('({empty:worker===null,pending:pending.size,terminated:testWorkers[0].testTerminated})');
  assert.deepEqual(firstState,{empty:true,pending:0,terminated:true});
  await offscreen('globalThis.setTimeout=nativeTimeout;true');
  const secondPromise=request();
  const staleState=await offscreen(`new Promise((resolve,reject)=>{let attempts=0;function check(){
   if(testWorkers.length<2||pending.size===0){if(++attempts>500){reject(new Error('new generation did not start'));return;}nativeTimeout(check,10);return;}
   const active=worker,id=[...pending.keys()][0];
   staleMessage({data:{id,tokens:[{surface:'先生',reading:'WRONG'}]}});staleError({preventDefault(){}});
   resolve({sameWorker:worker===active,newWorkerTerminated:!!active.testTerminated,pending:pending.size});
  }check();})`,true);
  assert.deepEqual(staleState,{sameWorker:true,newWorkerTerminated:false,pending:1});
  const second=await secondPromise;assert.equal(second.tokens.find(t=>t.surface==='先生').reading,'せんせい');
  const final=await offscreen('({workerCount:testWorkers.length,firstTerminated:testWorkers[0].testTerminated,secondTerminated:!!testWorkers[1].testTerminated,pending:pending.size})');
  assert.deepEqual(final,{workerCount:2,firstTerminated:true,secondTerminated:false,pending:0});
  console.log('PASS: real MV3 timeout terminates hung Worker, next request reads 先生 → せんせい, stale message/error ignored');
 }finally{await context.close();}
 }finally{await fs.rm(profile,{recursive:true,force:true,maxRetries:3});}
})().catch(error=>{console.error(error);process.exitCode=1;});

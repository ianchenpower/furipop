// Synthetic X DOM matrix; not a live-site or reading-accuracy benchmark.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'work'),{recursive:true});
 const profile=await fs.mkdtemp(path.join(root,'work/browser-matrix-'));
 try{
 const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']});
 const results=[],pageErrors=[];
 try{
 const sw=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[{word:'𠮷田',reading:'よしだ'}]}));
 const page=await context.newPage({viewport:{width:600,height:450}});page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-TW"><meta charset="utf-8"><style>body{margin:16px;font:24px sans-serif}article{margin:12px 0}</style><article id="tweet" data-testid="tweetText" lang="ja">今日は<span id="word">図書館</span>へ行く。</article></html>'}));await page.goto('https://x.com/test');
 const tip=page.locator('#furipop-tooltip');
 async function reading(expected,timeout=2500){await page.locator('#word').hover({position:{x:5,y:12}});await page.waitForFunction(value=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent===value;},expected,{timeout});}
 await reading('としょかん',15000);
 const wrappers=['span','bdi','strong','em'];
 for(const [n,tag] of wrappers.entries())for(const split of [false,true])for(const width of [320,600,1000]){
  const label='inline:'+tag+':split='+split+':width='+width;
  try{await page.setViewportSize({width,height:450});await page.evaluate(({tag,split})=>{const w=document.querySelector('#word');w.replaceChildren();if(split){for(const c of '図書館'){const e=document.createElement(tag);e.textContent=c;w.append(e);}}else{const a=document.createElement(tag),b=document.createElement('span');b.textContent='図書館';a.append(b);w.append(a);}}, {tag,split});
  const original=await page.locator('#tweet').innerHTML();await reading('としょかん');const bounds=await tip.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.equal(await page.locator('#tweet').innerHTML(),original);results.push({label,pass:true});}catch(e){results.push({label,pass:false,error:e.message});}
 }
 for(let n=0;n<12;n++){
  const word=n%2?'図書館':'学校',expected=n%2?'としょかん':'がっこう';
  const label='SPA-replacement:'+n;
  try{await page.evaluate(word=>{const next=document.createElement('span');next.id='word';next.textContent=word;document.querySelector('#word').replaceWith(next);},word);await page.waitForTimeout(20);assert.equal(await tip.isVisible(),false);await page.mouse.move(1,1);await reading(expected);results.push({label,pass:true});}catch(e){results.push({label,pass:false,error:e.message});}
 }
 for(const lang of ['zh','zh-TW'])for(const text of ['今天去學校','今天看すいせい直播','這個一定有（やりますねぇ）','今天的天氣很好']){
  const label='Chinese:'+lang+':'+text;
  try{await page.evaluate(({lang,text})=>{const t=document.querySelector('#tweet');t.lang=lang;t.replaceChildren();const w=document.createElement('span');w.id='word';w.textContent=text;t.append(w);},{lang,text});await page.locator('#word').hover({position:{x:5,y:12}});await page.waitForTimeout(160);assert.equal(await tip.isVisible(),false);results.push({label,pass:true});}catch(e){results.push({label,pass:false,error:e.message});}
 }
 {
  const label='Chinese-long-mistagged-ja';
  try{await page.evaluate(()=>{const t=document.querySelector('#tweet');t.lang='ja';t.replaceChildren();const w=document.createElement('span');w.id='word';w.textContent='下班後去超市買了牛奶、雞蛋和水果。';t.append(w);});await page.locator('#word').hover({position:{x:5,y:12}});await page.waitForTimeout(250);assert.equal(await tip.isVisible(),false);results.push({label,pass:true});}catch(e){results.push({label,pass:false,error:e.message});}
 }
 for(const width of [320,600,1000]){
  const label='supplementary-name:'+width;
  try{await page.setViewportSize({width,height:450});await page.evaluate(()=>{const t=document.querySelector('#tweet');t.lang='ja';t.replaceChildren();const w=document.createElement('span');w.id='word';w.textContent='𠮷田';t.append(w,'さんを見る。');});await reading('よしだ');results.push({label,pass:true});}catch(e){results.push({label,pass:false,error:e.message});}
 }
 const summary={suite:'browser-matrix',cases:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),pageErrors};console.log(JSON.stringify(summary));await fs.writeFile(path.join(root,'work/browser-matrix-result.json'),JSON.stringify(summary,null,2));assert.equal(summary.failed.length,0);assert.equal(pageErrors.length,0);
 }finally{await context.close();}
 }finally{await fs.rm(profile,{recursive:true,force:true,maxRetries:3});}
})().catch(e=>{console.error(e);process.exitCode=1;});

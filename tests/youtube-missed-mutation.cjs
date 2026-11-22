// Verify the CC mirror recovers if a native caption update is not observed.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.setContent('<style>#movie_player{position:relative;width:600px;height:400px}.ytp-caption-window-container{position:absolute;top:200px}.ytp-caption-segment{font:24px sans-serif}</style><div id="movie_player"><div class="ytp-caption-window-container"><div class="caption-window"><div class="caption-visual-line"><span class="ytp-caption-segment">今日は学校へ行く。</span></div></div></div></div>');
  await page.evaluate(()=>{const Native=MutationObserver;window.skipCaptionNotifications=false;window.MutationObserver=class extends Native{constructor(callback){super((...args)=>{if(!window.skipCaptionNotifications)callback(...args);});}};Object.defineProperty(window,'chrome',{configurable:true,value:{storage:{sync:{get:(d,cb)=>cb({furipopEnabled:true})},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}},sendMessage:async({text})=>({tokens:Array.from(text).map((surface,start)=>({surface,start,end:start+1,reading:/[\p{Script=Han}]/u.test(surface)?'よみ':null}))})}}});});
  for(const file of ['vendor/tinyld/tinyld.light.js','content/language.js','content/youtube.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.waitForFunction(()=>document.querySelector('#furipop-yt-caption-overlay ruby'),{},{timeout:5000});
  await page.waitForTimeout(350);
  await page.evaluate(()=>{window.skipCaptionNotifications=true;document.querySelector('.ytp-caption-segment').textContent='今日は学校へ行きました。';});
  await page.waitForTimeout(450);
  const result=await page.evaluate(()=>{const body=document.querySelector('#furipop-yt-caption-overlay .furipop-caption-text');return Array.from(body.childNodes).map(n=>n.nodeType===3?n.data:n.firstChild?.data||'').join('');});
  assert.equal(result,'今日は学校へ行きました。','mirror must catch up even when native mutation callback is missed');
  // Real YouTube roll-up CC retains a translated, clipped line in its DOM.
  await page.evaluate(()=>{const win=document.querySelector('.caption-window');win.style.cssText='height:60px;overflow:hidden';win.innerHTML='<div style="transform:translateY(-30px)"><div class="caption-visual-line" style="height:30px"><span class="ytp-caption-segment">古い字幕です。</span></div><div class="caption-visual-line" style="height:30px"><span class="ytp-caption-segment">今日は学校へ</span></div><div class="caption-visual-line" style="height:30px"><span class="ytp-caption-segment">行きました。</span></div></div>';});
  await page.waitForTimeout(450);
  const rollup=await page.evaluate(()=>{const body=document.querySelector('#furipop-yt-caption-overlay .furipop-caption-text');return body&&Array.from(body.childNodes).map(n=>n.nodeType===3?n.data:n.firstChild?.data||'').join('');});
  assert.equal(rollup,'今日は学校へ\n行きました。','clipped roll-up lines must not replace the current caption');
  await page.evaluate(()=>{
   window.skipCaptionNotifications=false;
   window.requestAnimationFrame=()=>123456;
   document.querySelector('.caption-visual-line:last-child .ytp-caption-segment').textContent='歩いて帰りました。';
  });
  await page.waitForFunction(()=>{
   const body=document.querySelector('#furipop-yt-caption-overlay .furipop-caption-text');
   const plain=body&&Array.from(body.childNodes).map(n=>n.nodeType===3?n.data:n.firstChild?.data||'').join('');
   return plain==='今日は学校へ\n歩いて帰りました。';
  },null,{polling:50,timeout:1500});
  await page.evaluate(()=>{document.querySelector('.ytp-caption-window-container').style.display='none';});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#furipop-yt-caption-overlay').count(),0,'hidden native captions must restore the original state');
  console.log('PASS: missed caption mutation fallback catches up');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

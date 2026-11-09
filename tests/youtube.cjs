// Requires playwright-core and an extension-capable Chromium browser.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'work'),{recursive:true});const profile=await fs.mkdtemp(path.join(root,'work/youtube-test-'));
 try{
 const ctx=await chromium.launchPersistentContext(profile,{executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']});
 try{
  const sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]}));
  const page=await ctx.newPage({viewport:{width:1000,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{font:22px sans-serif;margin:30px}#movie_player{position:relative;width:600px;height:300px;background:#444}.ytp-caption-window-container{position:absolute;left:80px;top:170px;pointer-events:none}.caption-window{display:inline-block;touch-action:none}.ytp-caption-segment{font-size:24px;color:white}.cc-off .ytp-caption-window-container{display:none}</style><ytd-watch-metadata><h1>今日は<span id="title-word">図書館</span>へ行く。</h1></ytd-watch-metadata><ytd-watch-flexy><div id="description">今日は<a href="/example" id="desc-word">学校</a>へ行く。</div></ytd-watch-flexy><ytd-comment-thread-renderer><div id="content-text">今日は<span id="comment-word">先生</span>に会う。</div></ytd-comment-thread-renderer><div id="movie_player"><div class="ytp-caption-window-container"><div class="caption-window"><span class="ytp-caption-segment">今日は図書館へ行く。</span></div></div><button id="overlap-control" style="position:absolute;left:80px;top:170px;width:35px;height:25px;z-index:59">X</button><button id="control" style="position:absolute;bottom:0">control</button></div>'}));
  await page.goto('https://www.youtube.com/watch?v=fixture');
  async function hover(id,expected){await page.locator(id).hover();await page.waitForFunction(v=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent===v;},expected,{timeout:15000});}
  await hover('#title-word','としょかん');await hover('#desc-word','がっこう');
  await page.evaluate(()=>{window.linkClicks=0;document.querySelector('#desc-word').addEventListener('click',e=>{e.preventDefault();window.linkClicks++;});});
  await page.locator('#desc-word').click();assert.equal(await page.evaluate(()=>window.linkClicks),1);
  await hover('#comment-word','せんせい');
  await page.waitForFunction(()=>document.querySelector('#furipop-yt-caption-overlay ruby rt')?.textContent==='きょう',{},{timeout:5000});
  assert.equal(await page.locator('.ytp-caption-segment').textContent(),'今日は図書館へ行く。');
  await page.evaluate(()=>document.querySelector('#furipop-yt-caption-overlay').remove());
  await page.waitForFunction(()=>document.querySelector('#furipop-yt-caption-overlay ruby rt')?.textContent==='きょう');
  const overlay=page.locator('#furipop-yt-caption-overlay');const box=await overlay.boundingBox();const player=await page.locator('#movie_player').boundingBox();assert.ok(box.width<player.width&&box.height<player.height);
  const controlIsClickable=await page.evaluate(()=>{const b=document.querySelector('#overlap-control').getBoundingClientRect();return document.elementFromPoint(b.left+5,b.top+5)?.id==='overlap-control';});
  assert.equal(controlIsClickable,true,'player controls must remain above caption overlay');
  assert.equal(await overlay.locator('ruby').count(),3);
  const readingStyle=await overlay.locator('ruby rt').first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
  assert.equal(readingStyle.background,'rgba(0, 0, 0, 0.85)');assert.equal(readingStyle.color,'rgb(255, 255, 255)');
  assert.equal((await overlay.locator('ruby rt').allTextContents()).join('|'),'きょう|としょかん|いく');
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  const alignment=await page.evaluate(()=>{const src=document.querySelector('.ytp-caption-segment').firstChild,base=document.querySelector('#furipop-yt-caption-overlay ruby').firstChild;function top(node){const r=document.createRange();r.setStart(node,0);r.setEnd(node,1);return r.getBoundingClientRect().top;}return {native:top(src),overlay:top(base)};});
  assert.ok(Math.abs(alignment.native-alignment.overlay)<3,'annotated text should follow the native caption baseline: '+JSON.stringify(alignment));
  // Player width can change through layout alone, without a window resize.
  await page.evaluate(()=>{const p=document.querySelector('#movie_player');p.parentElement.classList.add('wide-player');const s=document.createElement('style');s.textContent='.wide-player #movie_player{width:750px!important}.wide-player .ytp-caption-window-container{left:40%}';document.head.append(s);});
  await page.waitForFunction(()=>{const src=document.querySelector('.ytp-caption-segment').getBoundingClientRect(),o=document.querySelector('#furipop-yt-caption-overlay').getBoundingClientRect();return Math.abs((src.left+src.right-o.left-o.right)/2)<3;},{},{timeout:5000});
  await page.evaluate(()=>document.querySelector('#movie_player').parentElement.classList.remove('wide-player'));
  await page.waitForFunction(()=>document.querySelector('#movie_player').getBoundingClientRect().width===600);
  // Separate windows must not be merged into one inaccurate overlay.
  await page.evaluate(()=>{const w=document.querySelector('.caption-window').cloneNode(true);w.id='second-caption-window';document.querySelector('.ytp-caption-window-container').append(w);});
  await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay')&&!document.querySelector('#movie_player').classList.contains('furipop-yt-active'));
  await page.evaluate(()=>document.querySelector('#second-caption-window').remove());
  await page.waitForFunction(()=>document.querySelector('#furipop-yt-caption-overlay ruby rt')?.textContent==='きょう');
  // Model native YouTube caption settings at the segment and window levels.
  await page.evaluate(()=>{const segment=document.querySelector('.ytp-caption-segment');segment.style.fontFamily='serif';segment.style.color='rgb(255, 210, 40)';segment.style.backgroundColor='rgba(10, 20, 30, 0.4)';segment.style.textShadow='rgb(0, 0, 0) 1px 1px 2px';segment.style.opacity='0.7';segment.closest('.caption-window').style.backgroundColor='rgba(30, 40, 50, 0.3)';segment.closest('.caption-window').style.opacity='0.8';});
  await page.waitForFunction(()=>{const o=document.querySelector('#furipop-yt-caption-overlay'),b=o?.querySelector('.furipop-caption-text');return b&&getComputedStyle(b).color==='rgb(255, 210, 40)'&&getComputedStyle(b).backgroundColor==='rgba(10, 20, 30, 0.4)'&&getComputedStyle(o).backgroundColor==='rgba(30, 40, 50, 0.3)'&&getComputedStyle(o).opacity==='0.8'&&getComputedStyle(o).fontFamily==='serif'&&getComputedStyle(b).opacity==='0.7';});
  for(const px of [16,22,30,40]){
   await page.evaluate(px=>document.querySelector('.ytp-caption-segment').style.fontSize=px+'px',px);
   await page.waitForFunction(px=>getComputedStyle(document.querySelector('#furipop-yt-caption-overlay')).fontSize===px+'px',px);
   const points=await page.evaluate(()=>{const src=document.querySelector('.ytp-caption-segment').firstChild,base=document.querySelector('#furipop-yt-caption-overlay ruby').firstChild;function top(n){const r=document.createRange();r.setStart(n,0);r.setEnd(n,1);return r.getBoundingClientRect().top;}return [top(src),top(base)];});
   assert.ok(Math.abs(points[0]-points[1])<3,'baseline at font '+px+': '+points);
  }
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').style.fontSize='24px');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#furipop-yt-caption-overlay')).fontSize==='24px');
  // Simulate a native draggable caption window: overlay must pass the pointer
  // through and follow the window's actual moved geometry.
  await page.evaluate(()=>{const w=document.querySelector('.caption-window');let origin=null;w.addEventListener('pointerdown',e=>{origin={x:e.clientX,y:e.clientY};w.setPointerCapture(e.pointerId);});w.addEventListener('pointermove',e=>{if(origin)w.style.transform='translate('+(e.clientX-origin.x)+'px,'+(e.clientY-origin.y)+'px)';});w.addEventListener('pointerup',()=>{origin=null;});});
  const dragBox=await page.locator('.ytp-caption-segment').boundingBox();const beforeDrag=await overlay.boundingBox();
  await page.mouse.move(dragBox.x+dragBox.width-5,dragBox.y+dragBox.height/2);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width+35,dragBox.y+dragBox.height/2-20,{steps:4});await page.mouse.up();
  await page.waitForFunction(x=>document.querySelector('#furipop-yt-caption-overlay').getBoundingClientRect().left>x+25,beforeDrag.x);
  await page.evaluate(()=>document.querySelector('#control').addEventListener('click',()=>document.querySelector('#movie_player').requestFullscreen()));
  await page.locator('#control').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='movie_player');
  assert.equal(await overlay.locator('ruby rt').count(),3);
  assert.equal(await overlay.evaluate(e=>document.fullscreenElement.contains(e)),true);
  await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);
  await page.evaluate(()=>{window.captionClassChanges=[];new MutationObserver(records=>window.captionClassChanges.push(...records.map(r=>r.oldValue))).observe(document.querySelector('#movie_player'),{attributes:true,attributeOldValue:true,attributeFilter:['class']});});
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='明日は学校へ行く。');await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay ruby rt')).map(x=>x.textContent).join('|')==='あした|がっこう|いく');
  assert.equal(await page.evaluate(()=>window.captionClassChanges.length),0,'native subtitles must not be toggled between consecutive Japanese captions');
  await page.evaluate(()=>document.querySelector('#movie_player').classList.add('cc-off'));
  await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay'));
  await page.evaluate(()=>document.querySelector('#movie_player').classList.remove('cc-off'));
  await page.waitForSelector('#furipop-yt-caption-overlay');
  await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:false}));await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay')&&!document.querySelector('#movie_player').classList.contains('furipop-yt-active'));
  assert.equal(await page.locator('.ytp-caption-segment').textContent(),'明日は学校へ行く。');
  await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true}));await page.waitForSelector('#furipop-yt-caption-overlay');
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今天去學校');await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay'));
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='こんにちは');await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay')&&!document.querySelector('#movie_player').classList.contains('furipop-yt-active'));
  // Delay the first analysis response in the isolated extension context to
  // exercise out-of-order subtitle results through the real MV3 channel.
  const cdp=await ctx.newCDPSession(page),worlds=[];
  cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');
  const world=worlds.find(w=>w.origin.startsWith('chrome-extension://'));assert.ok(world);
  const hook=await cdp.send('Runtime.evaluate',{contextId:world.id,expression:`(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);globalThis.captionCalls=[];chrome.runtime.sendMessage=(message,...args)=>{if(message.type==='FURIPOP_ANALYZE')globalThis.captionCalls.push(message.text);const response=send(message,...args);if(message.type!=='FURIPOP_ANALYZE')return response;return response.then(value=>new Promise(resolve=>setTimeout(()=>resolve(value),message.text.startsWith('今日は')?800:10)));};return true;})()`,returnByValue:true});assert.equal(hook.result.value,true);
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今日は図書館へ行く。');await page.waitForTimeout(150);
  assert.equal(await page.locator('#furipop-yt-caption-overlay').count(),1,'fresh text stays visible while its reading is loading');
  assert.equal(await page.locator('#furipop-yt-caption-overlay .furipop-caption-text').textContent(),'今日は図書館へ行く。');
  assert.equal(await page.locator('#furipop-yt-caption-overlay ruby').count(),0,'do not display a stale reading');
  const plainTop=await page.evaluate(()=>{const text=document.querySelector('#furipop-yt-caption-overlay .furipop-caption-text').firstChild,r=document.createRange();r.setStart(text,0);r.setEnd(text,1);return r.getBoundingClientRect().top;});
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='明日は学校へ行く。');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay ruby rt')).map(x=>x.textContent).join('|')==='あした|がっこう|いく',{},{timeout:5000});
  const annotatedTop=await page.evaluate(()=>{const text=document.querySelector('#furipop-yt-caption-overlay ruby').firstChild,r=document.createRange();r.setStart(text,0);r.setEnd(text,1);return r.getBoundingClientRect().top;});
  assert.ok(Math.abs(plainTop-annotatedTop)<2,'base caption should not jump when furigana loads: '+plainTop+' vs '+annotatedTop);
  await page.waitForTimeout(1000);
  assert.equal((await page.locator('#furipop-yt-caption-overlay ruby rt').allTextContents()).join('|'),'あした|がっこう|いく','older delayed result must not replace the new subtitle');
  // Chinese captions must remain unannotated, while identifiable Japanese
  // in the same cue or line can still carry furigana.
  async function setCue(text,lang=''){
   await page.evaluate(({text,lang})=>{const source=document.querySelector('.ytp-caption-window-container');source.lang=lang;source.querySelector('.ytp-caption-segment').textContent=text;},{text,lang});
  }
  await setCue('今天去學校','ja');await page.waitForTimeout(800);
  assert.equal(await page.locator('#furipop-yt-caption-overlay').count(),0,'Chinese Han-only CC must not gain Japanese readings even when marked ja');
  for(const [text,lang] of [['今天去學校、今日は学校へ行く。',''],['今天去學校\n今日は学校へ行く。','zh-TW'],['学校、今日は学校へ行く。','zh-TW'],['今天去學校今日は学校へ行く。','']]){
   await setCue(text,lang);
   await page.waitForFunction(expected=>{const overlay=document.querySelector('#furipop-yt-caption-overlay');if(!overlay)return false;const clone=overlay.cloneNode(true);clone.querySelectorAll('rt').forEach(n=>n.remove());return clone.textContent===expected&&Array.from(overlay.querySelectorAll('ruby rt')).map(x=>x.textContent).join('|')==='きょう|がっこう|いく';},text,{timeout:5000});
   assert.equal((await page.locator('#furipop-yt-caption-overlay ruby').allTextContents()).join('|'),'今日きょう|学校がっこう|行くいく','only the Japanese segment may have readings');
  }
  await setCue('今天看すいせい直播','');
  await page.waitForFunction(()=>!document.querySelector('#furipop-yt-caption-overlay')&&!document.querySelector('#movie_player').classList.contains('furipop-yt-active'),{},{timeout:5000});
  await setCue('せーの お疲れ様[音楽]でした。突然です','ja');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay ruby rt')).map(x=>x.textContent).join('|')==='おつかれさま|おんがく|とつぜん',{},{timeout:5000});
  const captionLines=await page.evaluate(()=>{const e=document.querySelector('#furipop-yt-caption-overlay .furipop-caption-text');function top(n){const r=document.createRange();r.selectNodeContents(n);return r.getBoundingClientRect().top;}return [top(e.firstChild),top(e.lastChild)];});
  assert.ok(Math.abs(captionLines[0]-captionLines[1])<3,'furigana must not force this one-line caption onto a second line: '+captionLines);
  await setCue('今日は学校へ行く。','zh-TW');await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay ruby rt')).map(x=>x.textContent).join('|')==='きょう|がっこう|いく',{},{timeout:5000});
  // Rapid live-caption revisions should not enqueue an analysis for each frame.
  const beforeBurst=(await cdp.send('Runtime.evaluate',{contextId:world.id,expression:'captionCalls.length',returnByValue:true})).result.value;
  await page.evaluate(async()=>{const e=document.querySelector('.ytp-caption-segment');for(let i=0;i<15;i++){e.textContent='明日は学校へ行く。'+i;await new Promise(r=>setTimeout(r,25));}});
  await page.waitForFunction(()=>{const o=document.querySelector('#furipop-yt-caption-overlay');if(!o)return false;const copy=o.cloneNode(true);copy.querySelectorAll('rt').forEach(n=>n.remove());return copy.textContent==='明日は学校へ行く。14'&&o.querySelectorAll('ruby rt').length===3;},{},{timeout:5000});
  const afterBurst=(await cdp.send('Runtime.evaluate',{contextId:world.id,expression:'captionCalls.length',returnByValue:true})).result.value;
  assert.ok(afterBurst-beforeBurst<=2,'rapid caption revisions must be coalesced; requests='+String(afterBurst-beforeBurst));
  assert.deepEqual(errors,[]);console.log('PASS: YouTube title, description, comments, caption automatic ruby/update, native drag, YouTube styles, no stale text, native fallback, toggle and non-Japanese captions');
 }finally{await ctx.close();}
 }finally{await fs.rm(profile,{recursive:true,force:true,maxRetries:3});}
})().catch(e=>{console.error(e);process.exitCode=1;});

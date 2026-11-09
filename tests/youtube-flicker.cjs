// Progressive live CC stability; requires playwright-core and Edge/Chromium.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'work'),{recursive:true});const profile=await fs.mkdtemp(path.join(root,'work/flicker-test-'));
 try{
 const ctx=await chromium.launchPersistentContext(profile,{executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']});
 try{
  const sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]}));
  const page=await ctx.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:0}#movie_player{position:relative;width:900px;height:500px;background:#eee}.ytp-caption-window-container{position:absolute;left:100px;top:260px}.caption-window{display:inline-block}.ytp-caption-segment{font:32px sans-serif;color:white;background:rgba(0,0,0,.8)}</style><div id="movie_player"><div class="ytp-caption-window-container"><div class="caption-window"><span class="ytp-caption-segment">今日は図書館へ行く。</span></div></div><button id="control">control</button></div>'}));
  await page.goto('https://www.youtube.com/watch?v=flicker');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).map(n=>n.textContent).join('|')==='きょう|としょかん|いく',{},{timeout:15000});
  await page.evaluate(()=>{window.initialOverlay=document.querySelector('#furipop-yt-caption-overlay');window.initialRuby=window.initialOverlay.querySelector('ruby');window.captionTransitions=[];new MutationObserver(rs=>window.captionTransitions.push(...rs.map(r=>r.oldValue))).observe(document.querySelector('#movie_player'),{attributes:true,attributeOldValue:true,attributeFilter:['class']});});
  // Incremental captions can temporarily contain only Han before kana arrives.
  // Keep the same mirror briefly, but remove all old readings immediately.
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今日');await page.waitForTimeout(60);
  const transitional=await page.evaluate(()=>({sameOverlay:document.querySelector('#furipop-yt-caption-overlay')===window.initialOverlay,active:document.querySelector('#movie_player').classList.contains('furipop-yt-active'),readings:document.querySelectorAll('#furipop-yt-caption-overlay rt').length}));
  assert.ok(transitional.sameOverlay&&transitional.active&&transitional.readings===0,'a short Han-only transition must stay plain in the same overlay');
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今日は図書館へ行く。');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).map(n=>n.textContent).join('|')==='きょう|としょかん|いく',{},{timeout:8000});
  await page.evaluate(()=>{window.initialRuby=document.querySelector('#furipop-yt-caption-overlay ruby');});
  const suffix='新しい本を読みました。';const checks=[];
  for(let i=1;i<=suffix.length;i++){
   const text='今日は図書館へ行く。'+suffix.slice(0,i);
   await page.evaluate(value=>document.querySelector('.ytp-caption-segment').textContent=value,text);
   await page.waitForTimeout(45);
   checks.push(await page.evaluate(()=>({sameOverlay:document.querySelector('#furipop-yt-caption-overlay')===window.initialOverlay,sameRuby:document.querySelector('#furipop-yt-caption-overlay ruby')===window.initialRuby,active:document.querySelector('#movie_player').classList.contains('furipop-yt-active')})));
  }
  await page.waitForFunction(()=>{const o=document.querySelector('#furipop-yt-caption-overlay');if(!o)return false;const copy=o.cloneNode(true);copy.querySelectorAll('rt').forEach(n=>n.remove());return copy.textContent==='今日は図書館へ行く。新しい本を読みました。'&&Array.from(o.querySelectorAll('rt')).some(n=>n.textContent==='あたらしい');},{},{timeout:8000});
  // A continuous live cue must gain new readings before typing stops.
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今日は図書館へ行く。');
  await page.waitForTimeout(300);
  const liveSuffix='学校で勉強して、新しい本を読みながら友達と話しました。';let readingDuringTyping=false;
  for(let i=1;i<=liveSuffix.length;i++){
   await page.evaluate(value=>document.querySelector('.ytp-caption-segment').textContent='今日は図書館へ行く。'+value,liveSuffix.slice(0,i));
   await page.waitForTimeout(60);
   if(i<liveSuffix.length&&await page.locator('#furipop-yt-caption-overlay rt').evaluateAll(nodes=>nodes.some(n=>n.textContent==='がっこう')))readingDuringTyping=true;
  }
  assert.ok(readingDuringTyping,'new words should receive readings while live captions continue');
  await page.evaluate(()=>document.querySelector('.ytp-caption-segment').textContent='今日は図書館へ行く。新しい本を読みました。');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).some(n=>n.textContent==='あたらしい'),{},{timeout:8000});
  await page.evaluate(()=>{window.initialRuby=document.querySelector('#furipop-yt-caption-overlay ruby');});
  const after=await page.evaluate(()=>{const old=document.querySelector('.ytp-caption-window-container');old.replaceWith(old.cloneNode(true));return true;});await page.waitForTimeout(150);
  const replacement=await page.evaluate(()=>({sameOverlay:document.querySelector('#furipop-yt-caption-overlay')===window.initialOverlay,sameRuby:document.querySelector('#furipop-yt-caption-overlay ruby')===window.initialRuby,active:document.querySelector('#movie_player').classList.contains('furipop-yt-active')}));
  // YouTube may remove and recreate the native caption window across frames.
  await page.evaluate(()=>{window.savedWindow=document.querySelector('.caption-window');window.savedWindow.remove();});
  await page.waitForTimeout(55);
  const gap=await page.evaluate(()=>({sameOverlay:document.querySelector('#furipop-yt-caption-overlay')===window.initialOverlay,active:document.querySelector('#movie_player').classList.contains('furipop-yt-active')}));
  await page.evaluate(()=>document.querySelector('.ytp-caption-window-container').append(window.savedWindow));
  await page.waitForTimeout(100);
  assert.ok(gap.sameOverlay&&gap.active,'a short native window reconstruction must not destroy the visible overlay');
  assert.equal(await page.evaluate(()=>document.querySelector('#furipop-yt-caption-overlay')===window.initialOverlay),true);
  // An actually ended caption must clear even if the empty source keeps changing.
  await page.evaluate(async()=>{const source=document.querySelector('.ytp-caption-window-container');window.savedWindow=source.querySelector('.caption-window');window.savedWindow.remove();for(let i=0;i<10;i++){source.classList.toggle('noise');await new Promise(r=>setTimeout(r,25));}});
  assert.equal(await page.locator('#furipop-yt-caption-overlay').count(),0,'an extended empty interval must clear the old caption');
  await page.evaluate(()=>document.querySelector('.ytp-caption-window-container').append(window.savedWindow));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).some(n=>n.textContent==='あたらしい'),{},{timeout:8000});
  await page.evaluate(()=>{window.captionTransitions.length=0;});
  // If the track's language tag changes without a text change, old readings
  // must be removed before the new language policy is applied.
  await page.evaluate(()=>{const source=document.querySelector('.ytp-caption-window-container');source.lang='';source.querySelector('.ytp-caption-segment').textContent='音楽、今日は学校へ行く。';});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).map(e=>e.textContent).join('|')==='おんがく|きょう|がっこう|いく',{},{timeout:5000});
  await page.evaluate(()=>document.querySelector('.ytp-caption-window-container').lang='zh-TW');await page.waitForTimeout(50);
  assert.equal(await page.locator('#furipop-yt-caption-overlay rt').count(),0,'old readings must be cleared while language is being re-evaluated');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).map(e=>e.textContent).join('|')==='きょう|がっこう|いく',{},{timeout:5000});
  const transitions=await page.evaluate(()=>window.captionTransitions);
  console.log(JSON.stringify({updates:checks.length,unchangedPrefix:checks.filter(x=>x.sameRuby).length,sameOverlay:checks.filter(x=>x.sameOverlay).length,active:checks.filter(x=>x.active).length,replacement,transitions}));
  assert.ok(checks.every(x=>x.sameOverlay&&x.sameRuby&&x.active),'progressive text must preserve already-confirmed readings without replacing the overlay');
  assert.ok(replacement.sameOverlay&&replacement.sameRuby&&replacement.active,'same-player source replacement must preserve overlay and existing readings');
  assert.equal(transitions.length,0);assert.equal(errors.length,0);console.log('PASS: incremental CC preserves confirmed ruby and overlay through source replacement');
 }finally{await ctx.close();}
 }finally{await fs.rm(profile,{recursive:true,force:true,maxRetries:3});}
})().catch(e=>{console.error(e);process.exitCode=1;});

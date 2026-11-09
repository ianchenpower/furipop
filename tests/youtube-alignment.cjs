const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 await fs.mkdir(path.join(root,'work'),{recursive:true});
 const dir=await fs.mkdtemp(path.join(root,'work/alignment-'));
 try{
 const browser=await chromium.launchPersistentContext(dir,{executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']});
 try{
  const sw=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');
  await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]}));
  const p=await browser.newPage({viewport:{width:700,height:500}});
  for(const size of [20,24,32]){
   await p.route('https://www.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{margin:0}#movie_player{position:relative;width:600px;height:400px;background:#777}.ytp-caption-window-container{position:absolute;left:20px;top:120px}.caption-visual-line{line-height:${size*4/3}px}.ytp-caption-segment{font:${size}px sans-serif;color:white;background:#111}</style><div id="movie_player"><div class="ytp-caption-window-container"><div class="caption-window"><div class="caption-visual-line"><span class="ytp-caption-segment">今日は図書館へ行く。</span></div><div class="caption-visual-line"><span class="ytp-caption-segment">明日は学校へ行く。</span></div></div></div></div>`}));
   await p.goto('https://www.youtube.com/watch?v=lines'+size);
   await p.waitForFunction(()=>Array.from(document.querySelectorAll('#furipop-yt-caption-overlay rt')).some(x=>x.textContent==='あした'),{},{timeout:20000});
   const result=await p.evaluate(()=>{function top(n){const r=document.createRange();r.setStart(n,0);r.setEnd(n,1);return r.getBoundingClientRect().top;}const native=Array.from(document.querySelectorAll('.ytp-caption-segment')).map(e=>top(e.firstChild));const ruby=Array.from(document.querySelectorAll('#furipop-yt-caption-overlay ruby'));const by=s=>top(ruby.find(e=>e.firstChild.data===s).firstChild);return {native,overlay:[by('今日'),by('明日')]};});
   for(let i=0;i<2;i++)assert.ok(Math.abs(result.native[i]-result.overlay[i])<=4,`font ${size}px, line ${i+1}: ${JSON.stringify(result)}`);
   console.log(`PASS caption alignment ${size}px: ${JSON.stringify(result)}`);
   await p.unrouteAll();
  }
 }finally{await browser.close();}
 }finally{await fs.rm(dir,{recursive:true,force:true,maxRetries:3});}
})().catch(e=>{console.error(e);process.exitCode=1;});

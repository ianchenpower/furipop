// Optional integration test: set PLAYWRIGHT_CORE_PATH to an installed playwright-core package.
// EDGE_BINARY can select an extension-capable Chromium browser.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const work=path.join(root,'work');await fs.mkdir(work,{recursive:true});
 const profile=await fs.mkdtemp(path.join(work,'lifecycle-'));
 const context=await chromium.launchPersistentContext(profile,{
  executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']
 });
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]}));
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('https://x.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-TW"><meta charset="utf-8"><style>body{margin:40px;font:24px sans-serif}article{margin:20px;white-space:pre-wrap}</style><article lang="ja" data-testid="tweetText"><span id="word">素直</span>になれない先輩、私嫌いじゃないですよ。<br>やはり俺の青春ラブコメはまちがっている。<br>一色いろは</article><article lang="zh" data-testid="tweetText">我今天去了<span id="chinese">日本</span>。</article></html>'}));
  await page.goto('https://x.com/furipop-test');
  await page.evaluate(()=>{
   const text='24（+2）歲，曾經是個學生。\n目前，好想在求職路上進行王道征途。有什麼問題嗎？\n「這個一定有（*やりますねぇ）」\n壓力也Max捏……哈哈，嗚嗚嗚……';
   for(const lang of ['','ja','zh']){const a=document.createElement('article');a.dataset.testid='tweetText';a.lang=lang;a.id='mixed-'+(lang||'unknown');const before=text.indexOf('個');a.append(document.createTextNode(text.slice(0,before)));const p=document.createElement('span');p.className='probe';p.textContent='個';a.append(p,document.createTextNode(text.slice(before+1)));document.body.append(a);}
  });
  for(const id of ['mixed-unknown','mixed-ja','mixed-zh']){await page.locator('#'+id+' .probe').hover();await page.waitForTimeout(300);assert.equal(await page.locator('#furipop-tooltip').isVisible().catch(()=>false),false,id);}

  async function expectReading(){await page.locator('#word').hover();await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='すなお';},{},{timeout:15000});}
  await expectReading();
  await page.locator('#chinese').hover();await page.waitForTimeout(300);
  assert.equal(await page.locator('#furipop-tooltip').isVisible(),false);
  // Reload invalidates already-injected content scripts, even with a warm text cache.
  await worker.evaluate(()=>{setTimeout(()=>chrome.runtime.reload(),0);}).catch(()=>{});
  await page.waitForTimeout(700);
  await page.mouse.move(5,5);await page.locator('#word').hover();
  await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent.includes('請重新整理此 X 分頁');},{},{timeout:5000});
  await page.reload();await expectReading();
  await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('article'));getSelection().removeAllRanges();getSelection().addRange(r);});
  await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent.startsWith('すなおになれないせんぱい');},{},{timeout:5000});
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: screenshot sentence, mixed Chinese with Japanese quote under missing/ja/zh labels, Chinese suppression, extension reload with cached text, actionable stale-page message, F5 recovery and full-sentence selection');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

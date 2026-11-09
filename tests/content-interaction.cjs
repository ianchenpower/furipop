// Requires playwright-core; use PLAYWRIGHT_CORE_PATH for a local package.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const work=path.join(root,'work');await fs.mkdir(work,{recursive:true});
 const profile=await fs.mkdtemp(path.join(work,'interaction-fix-'));
 try{
 const browser=await chromium.launchPersistentContext(profile,{executablePath:process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions-except='+root,'--load-extension='+root],ignoreDefaultArgs:['--disable-extensions']});
 try{
 const sw=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');await sw.evaluate(()=>chrome.storage.sync.set({furipopEnabled:true,furipopDictionary:[]}));
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:40px;font:24px sans-serif}article{margin:20px}</style><article id="tweet" data-testid="tweetText" lang="ja">今日は<span id="word">図書館</span>へ行く。</article><article id="broken" data-testid="tweetText" lang="ja"><span id="day">日</span><br>本語を学ぶ。</article><article id="inline" data-testid="tweetText" lang="ja"><span id="first">日</span><span>本</span>語を学ぶ。</article><article id="emoji" data-testid="tweetText" lang="ja"><span id="emoji-day">日</span><img alt="📚">本語を学ぶ。</article><article id="blocks" data-testid="tweetText" lang="ja"><div><span id="block-day">日</span></div><div>本語を学ぶ。</div></article><article id="heading" data-testid="tweetText" lang="ja"><div><span id="heading-word">高校生活</span></div></article>'}));
 await page.goto('https://x.com/test');
 const tip=page.locator('#furipop-tooltip');
 await page.locator('#word').hover();await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='としょかん';},{},{timeout:15000});
 const stable=await page.evaluate(()=>{const b=document.querySelector('#word').getBoundingClientRect();document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:b.left+b.width/2+1,clientY:b.top+b.height/2}));return !document.querySelector('#furipop-tooltip').hidden;});
 await page.waitForTimeout(180);
 await page.evaluate(()=>document.querySelector('#word').textContent='学校');await page.waitForTimeout(80);
 const invalidated=!await tip.isVisible();
 await page.locator('#word').hover();await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='がっこう';},{},{timeout:5000});
 await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#tweet'));getSelection().removeAllRanges();getSelection().addRange(r);});
 await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='きょうはがっこうへいく。';},{},{timeout:5000});
 await page.mouse.move(10,10);await page.waitForTimeout(350);
 const selectionStable=await tip.isVisible();
 await page.evaluate(()=>{const article=document.createElement('article');article.id='long';article.dataset.testid='tweetText';article.lang='ja';article.textContent='今日は学校へ行く。'.repeat(180);document.body.append(article);const r=document.createRange();r.selectNodeContents(article);getSelection().removeAllRanges();getSelection().addRange(r);});
 await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent.length>500;},{},{timeout:15000});
 const longReading=await page.evaluate(()=>{const t=document.querySelector('#furipop-tooltip');return {role:t.getAttribute('role'),live:t.getAttribute('aria-live'),focusable:t.tabIndex===0,scrollable:t.scrollHeight>t.clientHeight,overflow:getComputedStyle(t).overflowY};});
 await tip.hover();await page.waitForTimeout(350);assert.ok(await tip.isVisible(),'tooltip must remain open when the pointer enters it');
 await page.locator('#furipop-tooltip').focus();
 const canFocus=await page.evaluate(()=>document.activeElement.id==='furipop-tooltip');
 await page.keyboard.press('PageDown');await page.waitForTimeout(200);
 assert.ok(await tip.evaluate(e=>e.scrollTop)>0,'keyboard must scroll long readings');
 await page.evaluate(()=>{const t=document.querySelector('#furipop-tooltip'),r=document.createRange();r.setStart(t.firstChild,0);r.setEnd(t.firstChild,5);getSelection().removeAllRanges();getSelection().addRange(r);});
 await page.waitForTimeout(300);
 assert.ok(await tip.isVisible(),'selecting tooltip text must not close it');
 assert.equal(await page.evaluate(()=>getSelection().toString()),'きょうはが');
 await page.keyboard.press('Escape');
 assert.equal(await tip.isVisible(),false,'Escape must close the tooltip');
 const longAccessible=longReading.role==='status'&&longReading.live==='polite'&&longReading.focusable&&longReading.scrollable&&longReading.overflow==='auto'&&canFocus;
 await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(220);
 await page.locator('#day').hover();await page.waitForTimeout(400);
 const boundary=await tip.isVisible()&&await tip.textContent()!=='にほんご';
 await page.locator('#first').hover();await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='にほんご';},{},{timeout:5000});
 const inline=await tip.textContent()==='にほんご';
 await page.evaluate(()=>document.querySelector('#inline').remove());await page.waitForTimeout(80);
 const removed=!await tip.isVisible();
 await page.locator('#emoji-day').hover();await page.waitForTimeout(350);
 const emojiBoundary=await tip.isVisible()&&await tip.textContent()!=='にほんご';
 await page.locator('#block-day').hover();await page.waitForTimeout(350);
 const blockBoundary=await tip.isVisible()&&await tip.textContent()!=='にほんご';
 await page.locator('#heading-word').hover({position:{x:5,y:12}});
 await page.waitForFunction(()=>{const t=document.querySelector('#furipop-tooltip');return t&&!t.hidden&&t.textContent==='こうこう';},{},{timeout:5000});
 const heading=await tip.textContent()==='こうこう';
 const checks={japaneseHeadingInBlock:heading,emojiSeparatesWords:emojiBoundary,blocksSeparateWords:blockBoundary,sameWordStable:stable,selectionStable,longSelectionAccessible:longAccessible,domChangeClearsOldReading:invalidated,lineBreakSeparatesWords:boundary,inlineSpansStillJoin:inline,removedAnchorClears:removed};
 console.log(JSON.stringify(checks));assert.ok(Object.values(checks).every(Boolean));assert.deepEqual(errors,[]);console.log('PASS: interaction regressions');
 }finally{await browser.close();}
 }finally{await fs.rm(profile,{recursive:true,force:true,maxRetries:3});}
})().catch(e=>{console.error(e);process.exitCode=1;});

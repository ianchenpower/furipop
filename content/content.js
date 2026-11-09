/* FuriPop 0.2: read text and anchor ranges; never rewrite React-owned nodes. */
(()=>{
'use strict';
let enabled=false, tip, epoch=0, timer, lastKey='', dictionaryVersion=0, customWords=[], active=null;
const {isJapanese,glyphBounds}=FuriPopLanguage;
const han=/[\p{Script=Han}々〆ヶ]/u;
const blocked='a,button,input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const youtubeSelector='ytd-watch-metadata h1, ytd-watch-flexy #description-inline-expander, ytd-watch-flexy #description, ytd-comment-thread-renderer #content-text, ytd-comment-view-model #content-text, ytd-comment-renderer #content-text, ytd-video-renderer #video-title, ytd-rich-item-renderer #video-title';
const contentSelector='[data-testid="tweetText"],[data-testid="UserDescription"],[data-testid="User-Name"],[data-testid="UserName"],'+youtubeSelector;
const cache=new Map(), pending=new Map();
const anchorObserver=new MutationObserver(mutations=>{
 if(!active)return;
 const container=active.container;
 const changed=mutations.some(m=>{
  if(m.target===tip||tip?.contains(m.target))return false;
  if(m.type==='attributes')return true;
  if(!container.contains(m.target))return false;
  if(m.type==='childList'&&[...m.addedNodes,...m.removedNodes].every(n=>n===tip))return false;
  return true;
 });
 if(!container.isConnected||changed)hide();
});
function hide(){epoch++;lastKey='';active=null;anchorObserver.disconnect();if(tip)tip.hidden=true;}
function watchAnchor(container,range,mode){
 anchorObserver.disconnect();active={container,range,mode};
 anchorObserver.observe(container,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['lang']});
 // Watch only the active container and its ancestors, including its removal.
 for(let parent=container.parentNode;parent;parent=parent.parentNode){anchorObserver.observe(parent,{childList:true,attributes:true,attributeFilter:['lang']});}
}
function show(text,rect){
 if(!enabled || !rect || (!rect.width&&!rect.height))return;
 if(!tip){tip=document.createElement('div');tip.id='furipop-tooltip';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');tip.setAttribute('aria-atomic','true');tip.tabIndex=0;}
 const tooltipRoot=document.fullscreenElement||document.documentElement;
 if(tip.parentNode!==tooltipRoot)tooltipRoot.append(tip);
 tip.textContent=text;tip.hidden=false;
 tip.style.left='8px';tip.style.top='8px';
 const b=tip.getBoundingClientRect();
 tip.style.left=Math.max(8,Math.min(innerWidth-b.width-8,rect.left+rect.width/2-b.width/2))+'px';
 tip.style.top=Math.max(8,Math.min(innerHeight-b.height-8,rect.top>=b.height+12?rect.top-b.height-8:rect.bottom+8))+'px';
}
async function analyze(text){
 if(!chrome.runtime?.id)throw Object.assign(new Error('Extension context invalidated.'),{code:'CONTEXT_INVALIDATED'});
 if(cache.has(text))return cache.get(text);
 if(pending.has(text))return pending.get(text);
 const version=dictionaryVersion;
 const promise=chrome.runtime.sendMessage({type:'FURIPOP_ANALYZE',text}).then(r=>{
   if(r?.error || !Array.isArray(r?.tokens))throw Object.assign(new Error(r?.error||'讀音引擎未回應'),{code:r?.code||'ENGINE_UNAVAILABLE'});
   if(version!==dictionaryVersion)throw new Error('詞典已更新');
   cache.set(text,r.tokens);if(cache.size>150)cache.delete(cache.keys().next().value);return r.tokens;
 }).finally(()=>{if(pending.get(text)===promise)pending.delete(text);});pending.set(text,promise);return promise;
}
function showError(error,rect){
 const detail=FuriPopErrors.describe(error);
 console.warn('[FuriPop]',detail.code,String(error?.message||error));
 show(detail.message,rect);
}
function caret(x,y){
 if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);return p&&{node:p.offsetNode,offset:p.offset};}
 const r=document.caretRangeFromPoint?.(x,y);return r&&{node:r.startContainer,offset:r.startOffset};
}
function localLanguage(element,container){
 const tagged=element?.closest('[lang]');
 // X UI language (html/body) is unrelated to the language of a tweet.
 return tagged && tagged!==document.documentElement && tagged!==document.body && (container.contains(tagged)||tagged===container)?tagged.lang:'';
}
function hasCustom(text){return customWords.some(word=>text.includes(word));}
function context(node){
 const parent=node.parentElement;
 const name=parent?.closest('[data-testid="User-Name"],[data-testid="UserName"]');
 const container=name?(parent.closest('a')||name):parent?.closest(contentSelector);
 const allowLink=!!name || (location.hostname==='www.youtube.com' && !!container);
 // Display names are links on X. Reading them must preserve their navigation.
 if(!container || parent.closest(allowLink?blocked.replace('a,',''):blocked))return null;
 const nodes=[];let text='';
 function separator(){if(text&&!text.endsWith('\n'))text+='\n';}
 function collect(n){
  if(n.nodeType===Node.TEXT_NODE){nodes.push({node:n,start:text.length,end:text.length+n.length});text+=n.data;return;}
  if(n.nodeType!==Node.ELEMENT_NODE||n.matches('script,style,[contenteditable="true"]'))return;
  if(n.tagName==='BR'){text+='\n';return;}
  if(n.tagName==='IMG'){text+=n.getAttribute('alt')||'\uFFFC';return;}
  const block=n!==container&&['DIV','P','LI','BLOCKQUOTE','PRE'].includes(n.tagName);
  if(block)separator();
  for(const child of n.childNodes)collect(child);
  if(block)separator();
 }
 collect(container);
 if(text.length>2000)return null;
 return {text,nodes,container,language:localLanguage(parent,name||container),part:nodes.find(p=>p.node===node)};
}
function tokenRange(ctx,token){
 const a=ctx.nodes.find(p=>p.end>token.start),b=ctx.nodes.find(p=>p.end>=token.end&&p.start<token.end);
 if(!a||!b)return null;const r=document.createRange();r.setStart(a.node,token.start-a.start);r.setEnd(b.node,token.end-b.start);return r;
}
function hitRect(range,x,y){return Array.from(range.getClientRects()).find(r=>x>=r.left-1&&x<=r.right+1&&y>=r.top-1&&y<=r.bottom+1);}
async function hover(x,y){
 if(!enabled || window.getSelection()?.toString().trim())return;
 const p=caret(x,y);if(!p || p.node.nodeType!==Node.TEXT_NODE){hide();return;}
 const ctx=context(p.node);if(!ctx?.part || !han.test(ctx.text)){hide();return;}
 const japanese=isJapanese(ctx.text,ctx.language);
 if(!japanese&&!hasCustom(ctx.text)){hide();return;}
 // A caret may be returned for nearby whitespace; require the pointer to hit a glyph.
 const probe=document.createRange();let bounds=glyphBounds(p.node.data,p.offset);
 if(!bounds){hide();return;}
 probe.setStart(p.node,bounds.start);probe.setEnd(p.node,bounds.end);
 // A caret on the right half points to the next glyph. Retry the previous grapheme.
 if(!hitRect(probe,x,y)&&p.offset>0){bounds=glyphBounds(p.node.data,p.offset-1);probe.setStart(p.node,bounds.start);probe.setEnd(p.node,bounds.end);}
 const offset=bounds.start;
 if(!hitRect(probe,x,y)){hide();return;}
 const key=ctx.text+'|'+(ctx.part.start+offset);
 if(key===lastKey && tip&&!tip.hidden)return;
 hide();lastKey=key;const request=epoch;
 watchAnchor(ctx.container,probe,'hover');
 const loadingTimer=setTimeout(()=>{if(request===epoch)show('正在載入本機日文詞典…',probe.getBoundingClientRect());},250);
 try{
  const tokens=await analyze(ctx.text);
  if(request!==epoch||!enabled||!p.node.isConnected||context(p.node)?.text!==ctx.text||context(p.node)?.language!==ctx.language)return;
  const token=tokens.find(t=>t.start<=ctx.part.start+offset&&t.end>ctx.part.start+offset);
  if(!token || !han.test(token.surface) || (!japanese&&!customWords.includes(token.surface))){hide();return;}
  const range=tokenRange(ctx,token),rect=range&&hitRect(range,x,y);
  if(rect){active.range=range;show(token.reading||'尚無可靠讀音：'+token.surface,rect);}else hide();
 }catch(e){if(request===epoch)showError(e,probe.getBoundingClientRect());}
 finally{clearTimeout(loadingTimer);}
}
async function selection(){
 hide();if(!enabled)return;
 const s=window.getSelection(),text=s?.toString().trim();
 if(!text || !han.test(text)||!s.rangeCount)return;
 const anchor=s.anchorNode?.parentElement;
 if(anchor?.closest(blocked.replace('a,','')))return;
 const range=s.getRangeAt(0).cloneRange(),rect=range.getBoundingClientRect();
 const common=range.commonAncestorContainer;
 const selectedContainer=common.nodeType===Node.ELEMENT_NODE?common:common.parentElement;
 const scope=selectedContainer?.closest(contentSelector);
 const japanese=isJapanese(scope?.textContent||text,localLanguage(selectedContainer,scope||selectedContainer));
 if(!japanese&&!hasCustom(text))return;
 if(text.length>2000){show('請選取 2000 字以內的文字',rect);return;}
 const request=epoch;watchAnchor(scope||selectedContainer,range,'selection');show('正在分析讀音…',rect);
 try{const tokens=await analyze(text);if(request!==epoch||!enabled||window.getSelection()?.toString().trim()!==text)return;
 const reading=tokens.map(t=>(japanese||customWords.includes(t.surface))?(t.reading||t.surface):t.surface).join('');
 const unknown=japanese&&tokens.some(t=>t.unknown);
 show(reading+(unknown?'（部分詞彙無可靠讀音，保留原文）':''),rect);
 }catch(e){if(request===epoch)showError(e,rect);}
}
document.addEventListener('pointermove',e=>{
 if(tip?.contains(e.target)){clearTimeout(timer);return;}
 if(!enabled||window.getSelection()?.toString().trim())return;
 clearTimeout(timer);
 if(active?.mode==='hover'&&active.container.isConnected&&hitRect(active.range,e.clientX,e.clientY))return;
 // Leave a short bridge across the gap between the source and the tooltip.
 timer=setTimeout(()=>hover(e.clientX,e.clientY),250);
},{passive:true});
document.addEventListener('selectionchange',()=>{const s=window.getSelection();if(tip&&!tip.hidden&&(tip.contains(s?.anchorNode)||tip.contains(s?.focusNode)))return;clearTimeout(timer);hide();timer=setTimeout(selection,180);});
document.addEventListener('pointerdown',e=>{if(tip?.contains(e.target))return;clearTimeout(timer);hide();});
document.addEventListener('pointerout',e=>{if(!e.relatedTarget){clearTimeout(timer);hide();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){clearTimeout(timer);hide();}});
window.addEventListener('scroll',e=>{if(tip?.contains(e.target))return;clearTimeout(timer);hide();},{capture:true,passive:true});
window.addEventListener('resize',hide);
function setEnabled(value){enabled=!!value;clearTimeout(timer);hide();}
function updateCustom(entries){customWords=Array.isArray(entries)?entries.filter(e=>typeof e?.word==='string'&&typeof e?.reading==='string').map(e=>e.word.trim()).filter(Boolean):[];}
chrome.storage.sync.get({furipopEnabled:true,furipopDictionary:[]},s=>{updateCustom(s.furipopDictionary);setEnabled(s.furipopEnabled);});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='sync')return;
 if(changes.furipopEnabled)setEnabled(changes.furipopEnabled.newValue);
 if(changes.furipopDictionary){updateCustom(changes.furipopDictionary.newValue);dictionaryVersion++;cache.clear();pending.clear();clearTimeout(timer);hide();}});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='FURIPOP_TOGGLE')setEnabled(m.enabled);});
})();

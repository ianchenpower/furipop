/* FuriPop 0.2: read text and anchor ranges; never rewrite React-owned nodes. */
(()=>{
'use strict';
let enabled=false, tip, epoch=0, timer, lastKey='', dictionaryVersion=0, customWords=[];
const {isJapanese,glyphBounds}=FuriPopLanguage;
const han=/[\p{Script=Han}々〆ヶ]/u;
const blocked='a,button,input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const cache=new Map(), pending=new Map();
function hide(){epoch++;lastKey='';if(tip)tip.hidden=true;}
function show(text,rect){
 if(!enabled || !rect || (!rect.width&&!rect.height))return;
 if(!tip){tip=document.createElement('div');tip.id='furipop-tooltip';tip.setAttribute('role','tooltip');document.documentElement.append(tip);}
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
 const container=name?(parent.closest('a')||name):parent?.closest('[data-testid="tweetText"],[data-testid="UserDescription"]');
 // Display names are links on X. Reading them must preserve their navigation.
 if(!container || parent.closest(name?blocked.replace('a,',''):blocked))return null;
 const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);const nodes=[];let text='',n;
 while(n=walker.nextNode()){
  if(n.parentElement.closest('script,style,[contenteditable="true"]'))continue;
  nodes.push({node:n,start:text.length,end:text.length+n.length});text+=n.data;
 }
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
 const loadingTimer=setTimeout(()=>{if(request===epoch)show('正在載入本機日文詞典…',probe.getBoundingClientRect());},250);
 try{
  const tokens=await analyze(ctx.text);
  if(request!==epoch||!enabled||!p.node.isConnected||context(p.node)?.text!==ctx.text||context(p.node)?.language!==ctx.language)return;
  const token=tokens.find(t=>t.start<=ctx.part.start+offset&&t.end>ctx.part.start+offset);
  if(!token || !han.test(token.surface) || (!japanese&&!customWords.includes(token.surface))){if(tip)tip.hidden=true;return;}
  const range=tokenRange(ctx,token),rect=range&&hitRect(range,x,y);
  if(rect)show(token.reading||'尚無可靠讀音：'+token.surface,rect);
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
 const scope=selectedContainer?.closest('[data-testid="tweetText"],[data-testid="UserDescription"],[data-testid="User-Name"],[data-testid="UserName"]');
 const japanese=isJapanese(scope?.textContent||text,localLanguage(selectedContainer,scope||selectedContainer));
 if(!japanese&&!hasCustom(text))return;
 if(text.length>2000){show('請選取 2000 字以內的文字',rect);return;}
 const request=epoch;show('正在分析讀音…',rect);
 try{const tokens=await analyze(text);if(request!==epoch||!enabled||window.getSelection()?.toString().trim()!==text)return;
 const reading=tokens.map(t=>(japanese||customWords.includes(t.surface))?(t.reading||t.surface):t.surface).join('');
 const unknown=japanese&&tokens.some(t=>t.unknown);
 show(reading+(unknown?'（部分詞彙無可靠讀音，保留原文）':''),rect);
 }catch(e){if(request===epoch)showError(e,rect);}
}
document.addEventListener('pointermove',e=>{clearTimeout(timer);if(!enabled)return;hide();timer=setTimeout(()=>hover(e.clientX,e.clientY),100);},{passive:true});
document.addEventListener('selectionchange',()=>{clearTimeout(timer);hide();timer=setTimeout(selection,180);});
document.addEventListener('pointerdown',()=>{clearTimeout(timer);hide();});
document.addEventListener('pointerout',e=>{if(!e.relatedTarget){clearTimeout(timer);hide();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){clearTimeout(timer);hide();}});
window.addEventListener('scroll',()=>{clearTimeout(timer);hide();},{capture:true,passive:true});
window.addEventListener('resize',hide);
function setEnabled(value){enabled=!!value;clearTimeout(timer);hide();}
function updateCustom(entries){customWords=Array.isArray(entries)?entries.filter(e=>typeof e?.word==='string'&&typeof e?.reading==='string').map(e=>e.word.trim()).filter(Boolean):[];}
chrome.storage.sync.get({furipopEnabled:true,furipopDictionary:[]},s=>{updateCustom(s.furipopDictionary);setEnabled(s.furipopEnabled);});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='sync')return;
 if(changes.furipopEnabled)setEnabled(changes.furipopEnabled.newValue);
 if(changes.furipopDictionary){updateCustom(changes.furipopDictionary.newValue);dictionaryVersion++;cache.clear();pending.clear();clearTimeout(timer);hide();}});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='FURIPOP_TOGGLE')setEnabled(m.enabled);});
})();

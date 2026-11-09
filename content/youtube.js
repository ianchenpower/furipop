/* YouTube captions: mirror visible Japanese CC without changing player-owned nodes. */
(()=>{
'use strict';
let enabled=false,player=null,source=null,overlay=null,frame=0,last='',requested='',requestedLanguage='',tokens=null,generation=0,renderedGeneration=-1,analysisTimer=0,analysisMaxTimer=0,analysisEpoch=0,acceptedRequest=0,fallbackTimer=0,fallbackText='',missingTimer=0;
const observer=new MutationObserver(()=>{
 // Once bound, caption changes are handled by the local observer, so ordinary
 // comments and recommendation churn need no repeated player work.
 if(!player||!source||!player.isConnected||!source.isConnected||(player.classList.contains('furipop-yt-active')&&(!overlay||!overlay.isConnected)))schedule();
});
const captions=new MutationObserver(schedule);
const playerSize=new ResizeObserver(schedule);
function clear(){
 if(missingTimer){clearTimeout(missingTimer);missingTimer=0;}
 if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=0;}fallbackText='';
 if(analysisTimer){clearTimeout(analysisTimer);analysisTimer=0;}
 if(analysisMaxTimer){clearTimeout(analysisMaxTimer);analysisMaxTimer=0;}analysisEpoch++;
 if(player?.classList.contains('furipop-yt-active'))player.classList.remove('furipop-yt-active');
 if(overlay)overlay.remove();overlay=null;last='';requested='';requestedLanguage='';tokens=null;renderedGeneration=-1;generation++;
}
const kana=/[ぁ-ゖァ-ヺｦ-ﾟ]/u;
const han=/[\p{Script=Han}々〆ヶ]/u;
function score(text,language){return FuriPopTinyLD.detectAll(text).find(x=>x.lang===language)?.accuracy||0;}
// Work with punctuation/line boundaries first. In unseparated mixed text,
// only accept a Japanese suffix after an independently Chinese prefix at a
// tokenizer boundary; uncertain Han is left unchanged rather than guessed.
function safeReadings(text,items){
 const sourceLang=(source?.getAttribute('lang')||'').toLowerCase().split('-')[0];
 const globalJapanese=sourceLang!=='zh'&&sourceLang!=='ko'&&score(text,'ja')>=0.7&&score(text,'zh')===0;
 const approved=[];
 for(const match of text.matchAll(/[^\p{P}\s]+/gu)){
  const block=match[0],start=match.index,end=start+block.length,firstKana=block.search(kana);
  if(firstKana<0){
   if(globalJapanese&&score(block,'ja')>=0.5&&score(block,'zh')===0)approved.push({start,end,mixed:false});
   continue;
  }
  const prefix=block.slice(0,firstKana);
  const prefixChinese=score(prefix,'zh')>=0.5&&score(prefix,'zh')>score(prefix,'ja');
  if(!prefixChinese&&FuriPopLanguage.isJapanese(block,'')){approved.push({start,end,mixed:false});continue;}
  if(!prefixChinese)continue;
  const boundaries=items.filter(t=>t.start>start&&t.start<=start+firstKana&&t.start<end).map(t=>t.start).slice(0,24);
  for(const boundary of boundaries){
   const left=text.slice(start,boundary),right=text.slice(boundary,end);
   const first=items.find(item=>item.start===boundary);
   // An unknown Han immediately before kana may belong to the Chinese prefix.
   if(!first||(!kana.test(first.surface)&&!(score(first.surface,'ja')>=0.5&&score(first.surface,'zh')===0)))continue;
   if(score(left,'zh')>=0.5&&score(left,'zh')>score(left,'ja')&&kana.test(right)&&FuriPopLanguage.isJapanese(right,'')&&score(right,'zh')===0){approved.push({start:boundary,end,mixed:true});break;}
  }
 }
 return items.map((item,index)=>{
  const range=approved.find(r=>item.start>=r.start&&item.end<=r.end);
  if(!range)return {...item,reading:null};
  if(range.mixed&&han.test(item.surface)&&!kana.test(item.surface)){
   const next=items[index+1];
   if(!next||next.start!==item.end||next.start>=range.end||!kana.test(next.surface))return {...item,reading:null};
  }
  return item;
 });
}
function requestReading(text,language){
 ++generation;requested=text;requestedLanguage=language;tokens=null;
 if(analysisTimer)clearTimeout(analysisTimer);
 // Debounce short bursts, but bound the wait during continuous live typing.
 if(!analysisMaxTimer)analysisMaxTimer=setTimeout(dispatchReading,350);
 analysisTimer=setTimeout(dispatchReading,120);
}
function dispatchReading(){
 if(analysisTimer){clearTimeout(analysisTimer);analysisTimer=0;}
 if(analysisMaxTimer){clearTimeout(analysisMaxTimer);analysisMaxTimer=0;}
 const text=requested,language=requestedLanguage,id=generation,epoch=analysisEpoch;
 if(!enabled||!text||!source?.isConnected)return;
  Promise.resolve().then(()=>chrome.runtime.sendMessage({type:'FURIPOP_ANALYZE',text})).then(result=>{
  if(epoch!==analysisEpoch||id<acceptedRequest||!enabled||requestedLanguage!==language||!requested.startsWith(text)||!source?.isConnected)return;
  if(result?.error||!Array.isArray(result?.tokens)||result.tokens.map(t=>t.surface).join('')!==text)throw new Error(result?.error||'字幕分析未完成');
  let analyzed=safeReadings(text,result.tokens);
  if(requested!==text){
   // The last token can change when more characters arrive. Retain only
   // complete earlier tokens and leave the remaining current text plain.
   analyzed=analyzed.filter(t=>t.end<text.length);
   const end=analyzed.length?analyzed[analyzed.length-1].end:0;
   analyzed.push({surface:requested.slice(end),start:end,end:requested.length,reading:null});
  }
  acceptedRequest=id;tokens=analyzed;renderedGeneration=-1;
  if(!tokens.some(t=>t.reading&&han.test(t.surface))){if(requested===text)clear();return;}
  schedule();
  }).catch(error=>{if(epoch===analysisEpoch&&id===generation){clear();console.warn('[FuriPop] YouTube caption reading:',error?.message||error);}});
}
function makeRuby(items){
 const fragment=document.createDocumentFragment();
 for(const item of items){
  if(!item.reading||!/[\p{Script=Han}々〆ヶ]/u.test(item.surface)){fragment.appendChild(document.createTextNode(item.surface));continue;}
  const ruby=document.createElement('ruby');ruby.appendChild(document.createTextNode(item.surface));
  const rt=document.createElement('rt');rt.textContent=item.reading;ruby.appendChild(rt);fragment.appendChild(ruby);
 }
 return fragment;
}
// Preserve only complete prefix nodes when YouTube appends text. The last
// unconfirmed word is rebuilt so a changing word cannot keep an old reading.
function baseText(node){return node.nodeType===Node.TEXT_NODE?node.data:node.tagName==='RUBY'?node.firstChild?.data||'':'';}
function updateText(body,previous,text){
 if(!previous||!text.startsWith(previous)){body.textContent=text;return;}
 const nodes=Array.from(body.childNodes);let offset=0,keep=0;
 for(const node of nodes){const part=baseText(node),end=offset+part.length;if(!part||end>=previous.length||text.slice(offset,end)!==part)break;offset=end;keep++;}
 const tail=text.slice(offset),first=nodes[keep];
 if(first?.nodeType===Node.TEXT_NODE){first.data=tail;for(const node of nodes.slice(keep+1))node.remove();}
 else{const textNode=document.createTextNode(tail);body.insertBefore(textNode,first||null);for(const node of nodes.slice(keep))node.remove();}
}
function matchesToken(node,item){
 const reading=item.reading&&han.test(item.surface)?item.reading:null;
 if(reading)return node?.nodeType===Node.ELEMENT_NODE&&node.tagName==='RUBY'&&baseText(node)===item.surface&&node.querySelector('rt')?.textContent===reading;
 return node?.nodeType===Node.TEXT_NODE&&node.data===item.surface;
}
function reconcileRuby(body,items){
 const nodes=Array.from(body.childNodes);let i=0;
 while(i<nodes.length&&i<items.length&&matchesToken(nodes[i],items[i]))i++;
 if(i===nodes.length&&i===items.length)return;
 const tail=makeRuby(items.slice(i)),anchor=nodes[i]||null;
 body.insertBefore(tail,anchor);for(const node of nodes.slice(i))node.remove();
}
function holdMissing(){
 if(!overlay?.isConnected||!player?.classList.contains('furipop-yt-active')){clear();return;}
 // YouTube sometimes reconstructs its caption nodes across adjacent frames.
 // Bridge only a short gap; explicit disable/navigation still clears at once.
 if(!missingTimer)missingTimer=setTimeout(()=>{missingTimer=0;clear();schedule();},120);
}
function cancelMissing(){if(missingTimer){clearTimeout(missingTimer);missingTimer=0;}}
function visible(el){const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;}
function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
function refresh(){
 frame=0;
 try{render();}catch(error){clear();console.warn('[FuriPop] YouTube caption overlay:',error?.message||error);}
}
function render(){
 const nextPlayer=document.querySelector('#movie_player');
 const nextSource=nextPlayer?.querySelector('.ytp-caption-window-container');
 if(enabled&&nextPlayer===player&&player&&!nextSource){holdMissing();return;}
 if(nextPlayer!==player||nextSource!==source){if(nextPlayer!==player){clear();playerSize.disconnect();if(nextPlayer)playerSize.observe(nextPlayer);}captions.disconnect();player=nextPlayer;source=nextSource;if(source){
  captions.observe(source,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class','hidden','lang']});
  // YouTube can toggle captions via an ancestor class without changing the text.
  for(let node=source.parentElement;node&&player.contains(node);node=node.parentElement)captions.observe(node,{attributes:true,attributeFilter:['style','class','hidden']});
 }}
 if(!enabled||!player||!source||!visible(source)){clear();return;}
 // Distinct caption windows can be positioned independently. Until each can
 // be mirrored separately, keep YouTube's original positioning intact.
 if(Array.from(source.querySelectorAll('.caption-window')).filter(visible).length>1){clear();return;}
 const segments=Array.from(source.querySelectorAll('.ytp-caption-segment')).filter(visible);
 const lines=Array.from(source.querySelectorAll('.caption-visual-line')).filter(visible);
 const text=(lines.length?lines.map(line=>line.textContent||'').join('\n'):segments.map(s=>s.textContent||'').join('')).trim();
 if(!text){holdMissing();return;}
 if(text.length>2000){clear();return;}
 cancelMissing();
 const eligible=han.test(text)&&kana.test(text);
 const language=source.getAttribute('lang')||'';
 let languageChanged=false;
 if(!eligible){
  // A live cue can briefly have only Han while it is still being typed. Keep
  // the existing mirror plain for a short grace period, never its old ruby.
  if(!overlay?.isConnected||!player.classList.contains('furipop-yt-active')){clear();return;}
  if(requested||tokens||analysisTimer||analysisMaxTimer){if(analysisTimer)clearTimeout(analysisTimer);if(analysisMaxTimer)clearTimeout(analysisMaxTimer);analysisTimer=0;analysisMaxTimer=0;analysisEpoch++;requested='';requestedLanguage='';tokens=null;generation++;}
  if(!fallbackTimer||fallbackText!==text){
   if(fallbackTimer)clearTimeout(fallbackTimer);fallbackText=text;
   fallbackTimer=setTimeout(()=>{fallbackTimer=0;fallbackText='';clear();},250);
  }
 }else{
  if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=0;}fallbackText='';
  // Show the new original text immediately in the existing mirror while its
  // reading is calculated. This keeps position and background stable as CC moves.
  languageChanged=text===requested&&language!==requestedLanguage;
  if(text!==requested||languageChanged)requestReading(text,language);
 }
 const rects=segments.flatMap(segment=>Array.from(segment.getClientRects())).filter(r=>r.width&&r.height);
 const playerRect=player.getBoundingClientRect();
 if(!rects.length||!playerRect.width||!playerRect.height){clear();return;}
 const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
 const right=Math.max(...rects.map(r=>r.right));
 if(!overlay||!overlay.isConnected){last='';overlay=document.createElement('div');overlay.id='furipop-yt-caption-overlay';overlay.lang='ja';player.appendChild(overlay);}
 let body=overlay.firstElementChild;
 if(!body){body=document.createElement('span');body.className='furipop-caption-text';overlay.replaceChildren(body);last='';renderedGeneration=-1;}
 if(!eligible){if(text!==last||body.querySelector('ruby'))body.textContent=text;last=text;renderedGeneration=-1;}
 else if(languageChanged){body.textContent=text;last=text;renderedGeneration=-1;}
 else if(text!==last){updateText(body,last,text);last=text;renderedGeneration=-1;}
 if(tokens&&renderedGeneration!==generation){reconcileRuby(body,tokens);renderedGeneration=generation;}
 const style=getComputedStyle(segments[0]);
 overlay.style.fontFamily=style.fontFamily;overlay.style.fontSize=style.fontSize;overlay.style.fontWeight=style.fontWeight;
 overlay.style.fontStyle=style.fontStyle;overlay.style.letterSpacing=style.letterSpacing;
 const nativeWindow=segments[0].closest('.caption-window');
 const windowStyle=nativeWindow?getComputedStyle(nativeWindow):null;
 overlay.style.backgroundColor=windowStyle?.backgroundColor||'transparent';
 overlay.style.opacity=windowStyle?.opacity||'1';
 overlay.style.borderRadius=windowStyle?.borderRadius||'0';
 body.style.color=style.color;body.style.backgroundColor=style.backgroundColor;
 body.style.textShadow=style.textShadow;body.style.opacity=style.opacity;
 body.style.textDecoration=style.textDecoration;body.style.webkitTextStroke=style.webkitTextStroke;
 // Furigana can be wider than the underlying kanji; reserve transparent
 // horizontal space around the same centre to prevent needless line wraps.
 const width=Math.min((right-left)*1.2,playerRect.width);
 const center=(left+right)/2-playerRect.left;
 overlay.style.left=Math.max(0,Math.min(playerRect.width-width,center-width/2))+'px';
 overlay.style.top=Math.max(0,top-playerRect.top-(parseFloat(style.fontSize)||24)*0.3)+'px';
 overlay.style.width=width+'px';
 // Hide native captions only after the mirror exists, keeping fallback on failures.
 if(!player.classList.contains('furipop-yt-active'))player.classList.add('furipop-yt-active');
}
function setEnabled(value){enabled=!!value;if(!enabled)clear();schedule();}
chrome.storage.sync.get({furipopEnabled:true},s=>setEnabled(s.furipopEnabled));
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='sync')return;if(changes.furipopEnabled)setEnabled(changes.furipopEnabled.newValue);if(changes.furipopDictionary){clear();schedule();}});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='FURIPOP_TOGGLE')setEnabled(m.enabled);});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
document.addEventListener('fullscreenchange',schedule);
document.addEventListener('yt-navigate-finish',()=>{clear();captions.disconnect();playerSize.disconnect();player=null;source=null;schedule();});
schedule();
})();

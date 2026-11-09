/* Conservative script hints, not a general language classifier. */
(function(scope){
 'use strict';
 const kana=/[ぁ-ゖァ-ヺｦ-ﾟ]/u;
 const decisions=new Map();
 function isJapanese(text,language=''){
  text=text.trim();
  const lang=language.toLowerCase().split('-')[0];
  if(['zh','ko'].includes(lang))return false;
  const key=lang+'|'+text;
  if(decisions.has(key))return decisions.get(key);
  let result=lang==='ja'||kana.test(text);
  // X can mislabel mixed Chinese/Japanese posts as ja. A short quote must
  // not authorize reading every Chinese character in the surrounding post.
  const hanCount=(text.match(/\p{Script=Han}/gu)||[]).length;
  // With no kana or sentence context, short Han-only headings are inherently
  // ambiguous. Trust the explicit tweet tag instead of the tiny model here;
  // untagged Han still stays disabled. This exception is single-line and bounded
  // so a Chinese paragraph containing a Japanese quote cannot qualify.
  const taggedHeading=lang==='ja' && hanCount>0 && hanCount<=12 &&
   !/[\r\n]/.test(text) && /^[\p{Script=Han}々〆ヶ\d\p{P}\p{Zs}]+$/u.test(text);
  if(hanCount>=4 && !taggedHeading){
   const scores=scope.FuriPopTinyLD.detectAll(text);
   const chinese=scores.find(s=>s.lang==='zh')?.accuracy||0;
   const japanese=scores.find(s=>s.lang==='ja')?.accuracy||0;
   // Scores are model weights, not calibrated probabilities. On a close
   // Chinese/Japanese mixture, suppress automatic readings conservatively.
   if(chinese>=0.3 && (chinese>=japanese || japanese-chinese<0.15))result=false;
   // Long Han-only text is ambiguous even if X tags it ja. When the model
   // has no meaningful Japanese evidence, leave it unannotated instead of
   // forcing Japanese readings onto possibly Chinese text. Short headings
   // retain the explicit-ja exception above.
   const hanOnly=/^[\p{Script=Han}々〆ヶ\d\p{P}\p{Zs}\s]+$/u.test(text);
   if(lang==='ja' && hanCount>12 && hanOnly && japanese<0.3)result=false;
  }
  decisions.set(key,result);if(decisions.size>150)decisions.delete(decisions.keys().next().value);
  return result;
 }
 // Never split surrogate pairs or ideographic variation sequences for hit testing.
 const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
 function glyphBounds(text,offset){
  let last=null;
  for(const part of segmenter.segment(text)){
   last={start:part.index,end:part.index+part.segment.length};
   if(last.end>offset)return last;
  }
  return last;
 }
 scope.FuriPopLanguage={isJapanese,glyphBounds};
})(typeof self==='undefined'?globalThis:self);

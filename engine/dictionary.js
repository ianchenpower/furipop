/* Shared validation for options and the tokenizer. */
(function(scope){
 'use strict';
 const toHiragana=text=>text.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 function normalize(entries){
  if(!Array.isArray(entries))throw new Error('詞典格式錯誤');
  if(entries.length>100)throw new Error('最多可儲存 100 個詞');
  const unique=new Map();
  for(const item of entries){
   const word=typeof item?.word==='string'?item.word.trim():'';
   const reading=typeof item?.reading==='string'?toHiragana(item.reading.trim()):'';
   if(!word||word.length>80||/[\r\n\t]/.test(word))throw new Error('詞彙須為 1～80 字，不能包含換行');
   if(!reading||reading.length>120||!/^[ぁ-ゖーゝゞ・ 　]+$/.test(reading))throw new Error('讀音請填寫 1～120 字的平假名或片假名');
   if(unique.has(word))throw new Error('詞典中已有相同詞彙：'+word);
   unique.set(word,{word,reading});
  }
  const value=Array.from(unique.values());
  if(new TextEncoder().encode(JSON.stringify(value)).length>6000)throw new Error('詞典容量已滿，請刪除部分詞彙');
  return value;
 }
 scope.FuriPopDictionary={normalize,toHiragana};
})(typeof self==='undefined'?globalThis:self);

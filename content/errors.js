/* Keep failures actionable; never log tweet text. */
(function(scope){
 'use strict';
 function describe(error){
  const message=String(error?.message||error||'');
  const code=error?.code;
  if(code==='CONTEXT_INVALIDATED'||/extension context invalidated/i.test(message))return {code:'CONTEXT_INVALIDATED',message:'FuriPop 已更新，請重新整理此 X 分頁（F5）'};
  if(code==='ENGINE_TIMEOUT'||/逾時|timed? ?out/i.test(message))return {code:'ENGINE_TIMEOUT',message:'詞典載入逾時，請稍後重試；持續失敗請重新載入 FuriPop'};
  if(code==='ENGINE_UNAVAILABLE'||/receiving end does not exist|message (?:port|channel) closed|connection/i.test(message))return {code:'ENGINE_UNAVAILABLE',message:'讀音引擎未連線，請重新載入 FuriPop，再重新整理 X'};
  return {code:code||'ANALYSIS_FAILED',message:'讀音分析失敗，請重新整理 X；持續失敗請查看擴充功能錯誤紀錄'};
 }
 scope.FuriPopErrors={describe};
})(typeof self==='undefined'?globalThis:self);

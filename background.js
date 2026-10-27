importScripts('engine/dictionary.js');
let creating;
async function ensureEngine() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) creating = chrome.offscreen.createDocument({url:'engine/offscreen.html', reasons:['WORKERS'], justification:'Run the local Japanese tokenizer in a shared worker without blocking X.'}).finally(()=>{creating=null;});
  await creating;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(message.type !== 'FURIPOP_ANALYZE') return;
  if(!sender.tab || typeof message.text !== 'string' || message.text.length > 2000) { reply({error:'Invalid request'}); return; }
  Promise.all([ensureEngine(), chrome.storage.sync.get({furipopDictionary:[]})]).then(([,settings])=>chrome.runtime.sendMessage({type:'FURIPOP_ENGINE', text:message.text, dictionary:FuriPopDictionary.normalize(settings.furipopDictionary)})).then(reply).catch(e=>reply({error:e.message}));
  return true;
});

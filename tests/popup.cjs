const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},toggle={checked:true,disabled:false,addEventListener:(n,f)=>handlers[n]=f},status={textContent:'',style:{}},button={addEventListener(){}};
 let domReady,callback,sent=0;
 const document={addEventListener:(n,f)=>{if(n==='DOMContentLoaded')domReady=f;},getElementById:id=>({'toggle-enabled':toggle,'status-text':status,'open-dictionary':button}[id])};
 const chrome={runtime:{lastError:null,openOptionsPage(){}},storage:{sync:{get:(defaults,cb)=>cb({furipopEnabled:true}),set:(value,cb)=>{callback=cb;}}},tabs:{query:(q,cb)=>cb([{id:1}]),sendMessage:()=>{sent++;return Promise.resolve();}}};
 vm.runInNewContext(await fs.readFile(path.resolve(__dirname,'../popup/popup.js'),'utf8'),{document,chrome});
 domReady();assert.equal(toggle.checked,true);assert.equal(toggle.disabled,false);
 toggle.checked=false;handlers.change({target:toggle});assert.equal(toggle.disabled,true);
 chrome.runtime.lastError={message:'quota'};callback();chrome.runtime.lastError=null;
 assert.equal(toggle.checked,true);assert.equal(toggle.disabled,false);assert.match(status.textContent,/失敗/);assert.equal(sent,0);
 toggle.checked=false;handlers.change({target:toggle});callback();
 assert.equal(toggle.checked,false);assert.equal(toggle.disabled,false);assert.equal(status.textContent,'外掛已暫停');assert.equal(sent,1);
 console.log('PASS: popup restores saved toggle and reports storage failures');
})().catch(e=>{console.error(e);process.exitCode=1;});

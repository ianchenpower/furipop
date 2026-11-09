// node tests/run.cjs [--all|--browser]. No model/API call is made by this runner.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const core=['japanese-readings.cjs','tokenizer.cjs','language.cjs','offscreen.cjs','options.cjs','popup.cjs','language-corpus.cjs','tokenizer-properties.cjs','offscreen-properties.cjs'];
const browser=['extension-lifecycle.cjs','content-interaction.cjs','worker-recovery.cjs','browser-matrix.cjs','youtube.cjs','youtube-flicker.cjs','youtube-alignment.cjs'];
(async()=>{
 const args=process.argv.slice(2);
 if(args.some(a=>!['--all','--browser'].includes(a)))throw new Error('Usage: node tests/run.cjs [--all|--browser]');
 const files=args.includes('--all')?core.concat(browser):args.includes('--browser')?browser:core;
 const results=[];
 for(const name of files){
  const file=path.join(__dirname,name),logs=[],started=Date.now();
  // Separate lexical contexts avoid collisions between standalone CJS fixtures.
  const state={env:{...process.env},exitCode:0};
  const sandbox={require:createRequire(file),module:{exports:{}},exports:{},__dirname,__filename:file,process:state,Intl,TextEncoder,setTimeout,clearTimeout,console:{log:(...items)=>logs.push(items.join(' ')),error:(...items)=>logs.push(items.join(' '))}};
  let error;
  try{await vm.runInNewContext(await fs.readFile(file,'utf8'),sandbox,{filename:file});}catch(e){error=e.stack||String(e);state.exitCode=1;}
  const result={file:name,passed:!state.exitCode&&!error,durationMs:Date.now()-started,logs,...(error?{error}:{})};results.push(result);
  console.log((result.passed?'PASS ':'FAIL ')+name+' ('+result.durationMs+'ms)');
  if(!result.passed)console.error(logs.join('\n')+'\n'+(error||''));
 }
 const report={createdAt:new Date().toISOString(),suiteCount:results.length,passed:results.filter(r=>r.passed).length,results};
 await fs.mkdir(path.join(root,'work'),{recursive:true});await fs.writeFile(path.join(root,'work/test-results.json'),JSON.stringify(report,null,2));
 console.log(report.passed+'/'+report.suiteCount+' suites passed; detailed results: work/test-results.json');
 if(report.passed!==report.suiteCount)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

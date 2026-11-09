'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {digest}=require('../planner/plan'),api=require('../kit-first/service'),memory=require('../memory/store'),terminal=require('../terminal/service');
const EXAMPLE='Quiero crear una plataforma SaaS multiempresa para tiendas con inventario compras proveedores caja ventas CRM omnicanal WhatsApp Facebook Instagram chatbot IA agenda recordatorios suscripciones mensuales cuotas';
function runTests(destination,composition){
 const args=['--test','--test-reporter=tap',...composition.files.filter(f=>f.path.startsWith('tests/')&&f.path.endsWith('.test.cjs')).map(f=>f.path)];
 // Never run project scripts, user files, installations or external providers.
 const env={PATH:path.dirname(process.execPath),...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{}),...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),LANG:'C.UTF-8'};
 const before=digest(composition.files.map(f=>[f.path,fs.readFileSync(path.join(destination,f.path),'utf8')]));
 const result=spawnSync(process.execPath,args,{cwd:destination,env,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
 const number=key=>Number(new RegExp('# '+key+' (\\d+)').exec(result.stdout||'')?.[1]||0),tests=number('tests'),passed=number('pass'),failed=number('fail'),skipped=number('skipped');
 const after=digest(composition.files.map(f=>[f.path,fs.readFileSync(path.join(destination,f.path),'utf8')]));
 return {ok:result.status===0&&tests>0&&passed+skipped===tests&&passed>0&&!failed&&before===after,tests,passed,failed,skipped,sourceDigest:before,filesPreserved:before===after,exitCode:result.status,scope:'generated-local-tests-only'};
}
function verify(){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-acceptance-')),checks=[];
 try{
  const requests=[...require('../commercial/combinations').list().combinations.map(c=>({id:c.id,text:c.request})),{id:'integrated-example',text:EXAMPLE}];
  for(const request of requests){
   const destination=path.join(root,request.id);
   const value=request.id==='integrated-example'?terminal.prepare(request.text,{destination}):null;
   const plan=value?.core||api.plan({destination,evidence:api.discover({destination}),request:{text:request.text,docker:true}});
   if(value&&!value.ok||!plan?.ok)throw Error('Acceptance request blocked: '+request.id);
   const composition=plan.composition;
   if(value)terminal.create(value,destination);else api.create(plan,destination);
   const result=runTests(destination,composition),before=memory.read(destination);
   const proof={scope:result.scope,host:process.platform+'/'+process.arch,runtime:process.version,tests:result.tests,passed:result.passed,failed:result.failed,skipped:result.skipped,planId:composition.planId,sourceDigest:result.sourceDigest,timestamp:new Date().toISOString()};
   // Generation never sets passed. Only this explicit acceptance run on its
   // own fresh temporary project appends local test evidence, never live claims.
   const localModules=before.modules.map(m=>m.id).filter(id=>['products','inventory','sales','cash','purchases','suppliers','crm','roles'].includes(id));
   const next=memory.seal({...before,revision:before.revision+1,implemented:result.ok?localModules:[],pending:before.modules.map(m=>m.id).filter(id=>!result.ok||!localModules.includes(id)),verification:{status:result.ok?'passed':'failed',limitations:['Local generated tests only; external channel/AI fixtures are simulated. No production or other-OS certification.'],proof}});memory.append(destination,before,next);
   const recorded=memory.read(destination);if(!memory.validate(recorded)||recorded.verification.status!==(result.ok?'passed':'failed'))throw Error('Invalid verification memory');
   checks.push({id:request.id,adapter:composition.adapter,planId:composition.planId,...result,manifestValidated:true,verificationRecorded:true,externalConnections:'disabled',...(result.ok?{}:{failure:'Generated tests failed; no skips converted to success.'})});
  }
  return {schemaVersion:1,kind:'kit-evolution-acceptance',ok:checks.length===10&&checks.every(c=>c.ok),timestamp:new Date().toISOString(),host:{platform:process.platform,architecture:process.arch,node:process.version},checks,totalTests:checks.reduce((n,c)=>n+c.tests,0),executedTests:checks.reduce((n,c)=>n+c.passed+c.failed,0),notExercisedTests:checks.reduce((n,c)=>n+c.skipped,0),liveProvidersVerified:false,externalRepositoriesDownloaded:false,dependenciesInstalled:false,dockerExecuted:false,otherPlatforms:'not-run',temporaryDataRemoved:true};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={verify,EXAMPLE};

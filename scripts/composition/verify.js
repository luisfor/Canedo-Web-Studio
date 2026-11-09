'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const engine=require('./engine'),request=require('../../examples/composition/tienda-crm.request.json');
function verify(){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-composition-verify-')),checks=[];
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 try{
  for(const architecture of ['modular-monolith','independent-services']){
   const plan=engine.plan({...request,architecture}),validation=engine.validate(plan);if(!validation.ok)throw Error('Generated plan failed validation');const out=path.join(root,architecture);engine.write(plan,out);
   const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs'],{cwd:out,env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
   const tests=Number(/# tests (\d+)/.exec(result.stdout||'')?.[1]||0),passed=Number(/# pass (\d+)/.exec(result.stdout||'')?.[1]||0),skipped=Number(/# skipped (\d+)/.exec(result.stdout||'')?.[1]||0);
   checks.push({architecture,planId:plan.planId,ok:result.status===0&&tests===5&&passed===5&&skipped===0,files:plan.files.length+1,planValidated:validation.ok,integrityVerified:engine.check(out).ok,tests,passed,skipped,exitCode:result.status,contractScope:validation.contractScope,composeSchemaValidated:validation.composeSchemaValidated,localHttpExecuted:result.status===0&&passed===5,sqliteTransactionsExecuted:result.status===0&&passed===5,...(result.status!==0?{failure:'Generated tests failed. Check loopback permissions and node:sqlite support; no failure is converted into a skip.'}:{})});
  }
  return {schemaVersion:1,kind:'composition-native-verification',ok:checks.every(c=>c.ok&&c.integrityVerified),timestamp:new Date().toISOString(),host:{platform:process.platform,architecture:process.arch,node:process.version},declaredProjectNode:request.nodeVersion,checks,externalProviders:'disabled; test adapters only',docker:{schemaValidated:true,engineExecuted:false,imagesDownloaded:false,containersStarted:false},externalRepositoriesDownloaded:false,dependenciesInstalled:false,globalConfigurationChanged:false,otherPlatforms:'not verified by this local run',scope:'Generated initial backend and contracts; no UI or production/provider certification',temporaryDataRemoved:true};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={verify};

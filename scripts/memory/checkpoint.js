'use strict';
const fs=require('node:fs'),path=require('node:path'),store=require('./store'),api=require('../kit-first/service'),{digest}=require('../planner/plan');
function checkpoint(root,{syntax=false,decisions=[]}={}){
 if(!Array.isArray(decisions)||decisions.length>20||decisions.some(s=>typeof s!=='string'||s.length>500))throw Error('Decisiones fuera de límite.');for(const text of decisions)api.validateRequest({text});
 const result=require('../workspace/static-validation').validate(root,{syntax});
 if(result.status==='blocked')throw Error('Inspección incompleta; no se registra checkpoint.');
 if(!fs.existsSync(path.join(root,'.devkit/project.json')))store.adopt({destination:root,evidence:api.discover({destination:root,technicalOnly:true})});
 const before=store.read(root),fresh=api.inspect(root),files=fresh.files.filter(f=>store.permitted(f.path)&&!f.path.startsWith('devkit.')).map(f=>({...f,ownership:before.files.some(o=>o.path===f.path&&o.digest===f.digest&&o.ownership==='kit-generated')?'kit-generated':'existing'}));
 const next=store.seal({...before,revision:before.revision+1,implemented:[],pending:before.modules.map(m=>m.id),files,contracts:files.filter(f=>f.path.startsWith('contracts/')).map(({path,digest})=>({path,digest})),decisions:[...before.decisions,...decisions],verification:{status:result.status==='passed'?'passed':result.status==='failed'?'failed':'not-run',limitations:[result.scope,'Pruebas de comportamiento y toolchains no ejecutados.',...result.pending.map(p=>p.reason).filter((x,i,a)=>a.indexOf(x)===i)],...(result.checks.length?{proof:{scope:'static-syntax-only',host:process.platform+'/'+process.arch,runtime:process.version,tests:result.checks.length,passed:result.passed,failed:result.failed,skipped:result.pending.length,planId:result.inspectionId,sourceDigest:result.sourceDigest,timestamp:new Date().toISOString()}}:{})}});
 store.append(root,before,next);return {ok:result.ok,manifestId:next.manifestId,revision:next.revision,scope:'metadata-checkpoint-only',validation:result,sourceFilesModified:false};
}
function summary(root){const state=store.read(root);return {projectId:state.projectId,manifestId:state.manifestId,revision:state.revision,architecture:state.architecture,languages:state.languages,frameworks:state.frameworks,databases:state.databases,modules:state.modules.map(m=>({id:m.id,status:m.status})),verification:state.verification,decisionCount:state.decisions.length,dependencyCount:state.dependencies.length,scope:'memory-summary-not-full-history'};}
module.exports={checkpoint,summary};

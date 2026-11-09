'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),api=require('../kit-first/service'),view=require('./context');
function benchmark(){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-efficiency-benchmark-'));try{
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'audit-fixture',dependencies:{react:'18.0.0'}}));fs.writeFileSync(path.join(root,'source.cjs'),'module.exports = 42;\n');fs.writeFileSync(path.join(root,'requirements.txt'),'fastapi==0.115.0\n');fs.writeFileSync(path.join(root,'.env'),'PRIVATE_TOKEN=not-exported');
 const cold=api.discoverEfficient({destination:root,cache:'disk'}),warm=api.discoverEfficient({destination:root,cache:'disk'}),full=api.discoverEfficient({destination:root,full:true});
 const summary=view.summary(warm.evidence),equivalent=[cold,warm,full].every(r=>r.evidence.evidenceId===cold.evidence.evidenceId);
 return {kind:'local-efficiency-benchmark',host:{platform:process.platform,architecture:process.arch,node:process.version},equivalent,cold:cold.metrics,warm:warm.metrics,full:full.metrics,output:{fullEvidenceBytes:view.bytes(full.evidence),summaryBytes:view.bytes(summary)},modelCalls:0,modelTokens:{state:'unknown',reason:'No provider invoked; external agent consumption unavailable.'},measuredScope:'synthetic-three-file-project; derived parsing and JSON output bytes',savingsPercent:'not-asserted',securityReadsPreserved:warm.metrics.filesRead===full.metrics.filesRead,temporaryDataRemoved:true};
 }finally{fs.rmSync(root,{recursive:true,force:true});}}
module.exports={benchmark};

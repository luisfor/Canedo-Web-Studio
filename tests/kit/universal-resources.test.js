'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const terminal=require('../../scripts/terminal/service'),technical=require('../../scripts/terminal/technical'),bridge=require('../../scripts/terminal/resources'),api=require('../../scripts/kit-first/service'),cli=require('../../scripts/devkit');
function target(t){const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-universal-resources-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'new');}
function report({platform='darwin',checks=[],managers=[]}={}){return {schemaVersion:2,system:{platform,architecture:'arm64',version:null,release:null,distribution:platform==='linux'?{id:'ubuntu',version:'24.04',like:[]}:null},checks,packageManagers:managers};}
test('natural-language technical plan reuses dependency planner, version policies, profiles and manual recipes',t=>{
 const destination=target(t),p=terminal.prepare('Crear web React PostgreSQL',{destination});const r=p.resources;
 assert.ok(r.toolPlan.items.some(i=>i.tool==='node'&&i.role==='dependency'));assert.ok(r.toolPlan.items.some(i=>i.tool==='postgresql-server'&&i.intent==='choose-deployment'));
 assert.ok(r.profiles.some(p=>p.id==='frontend'));assert.ok(!r.selected.some(t=>t.id==='git'));
 assert.ok(r.installation.some(i=>i.tool==='node'&&i.recipe==='node-manual-v1'));assert.ok(r.installation.some(i=>i.tool==='react'&&i.status==='no-recipe'));
 assert.equal(r.diagnostics.mode,'not-run');assert.equal(r.diagnostics.environmentRechecked,false);assert.equal(r.manualCommands.executionAllowed,false);assert.equal(terminal.validate(p,destination).ok,true);assert.ok(!fs.existsSync(destination));
});
test('chosen exact runtime versions generate existing profile/environment plans in memory only',t=>{
 const destination=target(t),p=terminal.prepare('Crear API Python FastAPI',{destination,resourceOptions:{versions:{python:'3.14.4'},manager:'pip'}});
 const e=p.resources.environmentPlans[0];assert.equal(e.profile,'backend');assert.equal(e.scope,'runtime-config-only');assert.ok(e.plan.projectPlan.files.some(f=>f.path==='.python-version'&&f.content==='3.14.4\n'));assert.deepEqual(e.plan.projectPlan.request.dependencies,{});assert.equal(e.plan.projectPlan.executionAllowed,false);assert.equal(terminal.validate(p,destination).ok,true);assert.ok(!fs.existsSync(destination));
});
test('unassessed frameworks are not declared compatible and an incompatible installed Node is never replaced',t=>{
 const destination=target(t),p=terminal.prepare('Crear web React',{destination,resourceOptions:{report:report({checks:[{tool:'node',status:'detected',version:'25.2.1'}],managers:[{id:'homebrew',status:'detected',version:null}]})}});
 const node=p.resources.toolPlan.items.find(i=>i.tool==='node');assert.equal(node.intent,'review-existing');assert.equal(node.current.compatibility.status,'incompatible');assert.equal(p.resources.manualCommands.steps.filter(s=>s.tool==='node'&&s.changesSystem).length,0);assert.equal(p.resources.toolPlan.items.find(i=>i.tool==='react').current.compatibility.status,'not-assessed');assert.equal(terminal.validate(p,destination).ok,true);
});
test('target OS restrictions, excluded dependencies and invalid requested versions stay visible',t=>{
 const destination=target(t);
 const mobile=terminal.prepare('Crear aplicación Android iPhone',{destination,resourceOptions:{report:report({platform:'win32'})}});assert.ok(mobile.resources.selected.some(t=>t.id==='android-sdk'));assert.ok(mobile.resources.toolPlan.blockers.some(b=>b.code==='platform-restriction'&&b.tool==='xcode'));assert.equal(mobile.status,'needs-decisions');
 const excluded=terminal.prepare('Crear web React sin Node',{destination});assert.ok(excluded.resources.toolPlan.blockers.some(b=>b.code==='required-tool-excluded'));
 const version=terminal.prepare('Crear API Python FastAPI',{destination,resourceOptions:{versions:{python:'3.99.0'}}});assert.ok(version.resources.toolPlan.blockers.some(b=>b.code==='target-outside-policy'));assert.equal(version.resources.environmentPlans.length,0);
 assert.throws(()=>terminal.prepare('Crear API Python',{destination,resourceOptions:{versions:{python:'latest'}}}));
});
test('optional profile tools never install themselves and undecided enterprise stacks remain undecided',t=>{
 const destination=target(t),p=terminal.prepare('Crear SaaS empresarial',{destination});assert.equal(p.resources.toolPlan,null);assert.equal(p.resources.environmentPlans.length,0);assert.ok(p.resources.profiles.some(p=>p.id==='enterprise'&&p.selection==='candidate-only'));assert.ok(p.resources.environmentDecisions.some(d=>d.code==='runtime-choice-required'));
 const iot=terminal.prepare('Crear IoT ESP32',{destination});assert.ok(iot.resources.selected.some(t=>t.id==='esp-idf'));assert.ok(!iot.resources.selected.some(t=>t.id==='arduino'));assert.equal(iot.resources.installation.find(t=>t.tool==='esp-idf').status,'no-recipe');
});
test('a blocked selection never prepares runtime files for an excluded dependency',t=>{
 const destination=target(t),p=terminal.prepare('Crear API FastAPI sin Python',{destination,resourceOptions:{versions:{python:'3.14.4'}}});assert.ok(p.resources.toolPlan.blockers.some(b=>b.code==='required-tool-excluded'));assert.equal(p.resources.environmentPlans.length,0);assert.ok(p.resources.environmentDecisions.some(d=>d.code==='tool-plan-blocked'));assert.ok(!p.resources.manualCommands.steps.some(s=>s.changesSystem));assert.ok(!fs.existsSync(destination));
});
test('default planning never executes diagnostics and explicit diagnostics use the existing safe doctor',t=>{
 const destination=target(t);let calls=0;t.mock.method(require('../../scripts/doctor/environment'),'diagnose',()=>{calls++;return report({checks:[{tool:'python',status:'detected',version:'3.14.4'}]});});
 terminal.prepare('Crear API Python FastAPI',{destination});assert.equal(calls,0);
 const p=terminal.prepare('Crear API Python FastAPI',{destination,diagnose:true});assert.equal(calls,1);assert.equal(p.resources.diagnostics.mode,'live-doctor');assert.equal(p.resources.toolPlan.items.find(i=>i.tool==='python').intent,'reuse');assert.equal(terminal.validate(p,destination).ok,true);assert.equal(calls,1);
});
test('version diagnostic environment preserves Windows casing and excludes interpreter injection flags',()=>{
 const original={Path:'C:\\Tools',SystemRoot:'C:\\Windows',ProgramFiles:'C:\\Program Files',NODE_OPTIONS:'--require untrusted.js',JAVA_TOOL_OPTIONS:'-javaagent:untrusted.jar',PRIVATE_TOKEN:'private'};
 const result=bridge.diagnosticEnvironment(original);assert.equal(result.Path,original.Path);assert.equal(result.SystemRoot,original.SystemRoot);assert.equal(result.ProgramFiles,original.ProgramFiles);assert.ok(!Object.hasOwn(result,'NODE_OPTIONS'));assert.ok(!Object.hasOwn(result,'JAVA_TOOL_OPTIONS'));assert.ok(!Object.hasOwn(result,'PRIVATE_TOKEN'));assert.equal(original.NODE_OPTIONS,'--require untrusted.js');
});
test('provided reports are sanitized, schema checked and cannot authorize execution',t=>{
 const destination=target(t),raw=report({checks:[{tool:'python',status:'detected',version:'3.14.4'}]});raw.privateValue='AUDIT_PRIVATE';raw.checks[0].stderr='AUDIT_PRIVATE';
 const p=terminal.prepare('Crear API Python',{destination,resourceOptions:{report:raw}});assert.ok(!JSON.stringify(p).includes('AUDIT_PRIVATE'));assert.equal(p.resources.diagnostics.mode,'provided-report');assert.equal(p.executionAllowed,false);
 const changed=structuredClone(p);changed.resources.manualCommands.executionAllowed=true;assert.equal(terminal.validate(changed,destination).ok,false);assert.throws(()=>terminal.prepare('Crear API Python',{destination,resourceOptions:{report:{}}}));assert.throws(()=>terminal.prepare('Crear API Python',{destination,diagnose:true,resourceOptions:{report:raw}}));
});
test('technical KIT-FIRST rejects stale target evidence and never downgrades full generator controls',t=>{
 const destination=target(t),p=terminal.prepare('Crear API Python',{destination});assert.equal(api.requireTechnicalCurrent(p.evidence,destination).evidenceId,p.evidence.evidenceId);assert.throws(()=>api.requireCurrent(p.evidence,destination),/desactualizada/);assert.throws(()=>api.requireTechnicalCurrent(p.evidence,path.join(path.dirname(destination),'other')),/desactualizada/);assert.throws(()=>terminal.create(p,destination));assert.ok(!fs.existsSync(destination));
});
test('fresh-process planning and KIT-FIRST do not load commercial modules, generators or their catalogs',t=>{
 const destination=target(t),code=`const fs=require('fs'),Module=require('module'),path=require('path'),assert=require('assert/strict');const original=Module._load,read=fs.readFileSync;Module._load=function(id,...rest){if(/(?:composition|commercial)/.test(id))throw Error('Disabled optional module: '+id);return original.call(this,id,...rest);};fs.readFileSync=function(file,...rest){if(typeof file==='string'&&/(?:catalog|schemas)[/\\\\](?:commercial|composition)/.test(file))throw Error('Disabled optional catalog');return read.call(this,file,...rest);};const t=require('./scripts/terminal/service');const p=t.prepare('Crear API Python FastAPI',{destination:process.argv[1]});assert.equal(p.kind,'technical-project-plan');assert.equal(t.validate(p,process.argv[1]).ok,true);assert.ok(!fs.existsSync(process.argv[1]));console.log('independent');`;
 const r=spawnSync(process.execPath,['-e',code,destination],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/independent/);
});
test('CLI accepts reviewed version/manager/report choices and rejects mixed or executable inputs',t=>{
 const destination=target(t),p=cli.dispatch(cli.parse(['plan','Crear API Python FastAPI','--out',destination,'--version','python=3.14.4','--manager','pip']));assert.ok(p.resources.environmentPlans.length);
 for(const args of [['plan','Crear API Python','--diagnose','--report','x'],['plan','Crear API Python','--version','python=latest'],['plan','Crear API Python','--version','python=3.14.4','--version','python=3.14.4'],['create','Crear API','--diagnose'],['plan','Crear API','--execute']])assert.throws(()=>cli.parse(args));
 assert.throws(()=>bridge.options({command:'npm install'}));assert.throws(()=>bridge.options({diagnosticMode:'fake'}));
 const file=path.join(path.dirname(destination),'doctor.json');fs.writeFileSync(file,JSON.stringify(report({checks:[{tool:'python',status:'detected',version:'3.14.4'}]})));
 const result=spawnSync(process.execPath,[path.resolve(__dirname,'../../scripts/devkit.js'),'plan','Crear API Python FastAPI','--out',destination,'--report',file,'--version','python=3.14.4','--json'],{encoding:'utf8',env:{...process.env,PATH:''}});assert.equal(result.status,0,result.stderr);const saved=JSON.parse(result.stdout);assert.equal(saved.resources.diagnostics.mode,'provided-report');assert.equal(terminal.validate(saved,destination).ok,true);assert.ok(!fs.existsSync(destination));
});

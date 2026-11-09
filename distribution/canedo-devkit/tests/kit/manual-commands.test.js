'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createPlan,digest}=require('../../scripts/planner/plan');
const {readToolCatalog}=require('../../scripts/tools/catalog');
const tools=readToolCatalog(),caps=require('../../config/kit-capabilities.json');
const catalog=require('../../scripts/commands/catalog'),recipes=catalog.loadRecipes(tools);
const {generate,validateCommandPlan}=require('../../scripts/commands/plan');
const {quote,render}=require('../../scripts/commands/render');
const policy=require('../../scripts/commands/policy'),installers=require('../../scripts/installers');
const go=require('../../scripts/installers/go'),archive=require('../../scripts/installers/archive-engine'),{definitions}=require('../../scripts/installers/archive-recipes');
const cli=path.resolve(__dirname,'../../scripts/kit.js');
const versions={node:'24.22.2',go:'1.27.3',python:'3.13.18',git:'2.52.0',java:'21.0.8',dotnet:'10.0.100',terraform:'1.13.4',docker:'29.0.2'};
function dplan(ids=['go'],platform='darwin',method='homebrew',extra={}) {
  const {checks,distribution,managers,...request}=extra;
  return createPlan(tools,caps,{schemaVersion:2,system:{platform,architecture:'arm64',distribution:distribution===undefined?(platform==='linux'?{id:method==='dnf'?'fedora':'ubuntu',version:'24.04',like:[]}:null):distribution},checks:checks||ids.map(tool=>({tool,status:'missing',version:null})),packageManagers:managers||[{id:method,status:'detected',version:null}]},{tools:ids,versions:Object.fromEntries(ids.filter(id=>versions[id]).map(id=>[id,versions[id]])),...request});
}
function temp(t){const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-manual-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function run(...args){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000});}
function mutation(result){return result.steps.filter(s=>s.changesSystem);}
function snapshot(tool='go',platform='darwin') {
 const plan=dplan([tool],platform,'homebrew');const version=versions[tool];
 if(tool==='go') {
  const arch=platform==='win32'?'windows':'darwin',filename=`go${version}.${arch}-arm64.${platform==='win32'?'zip':'tar.gz'}`;
  const index=[{version:'go'+version,stable:true,files:[{filename,version:'go'+version,os:arch,arch:'arm64',sha256:'a'.repeat(64),size:100,kind:'archive'}]}];
  return go.buildPrepared(plan,go.resolveArtifact(index,version,platform,'arm64'),platform==='win32'?"C:\\Users\\Example\\new folder's":"/example/new folder's",Date.now(),tools,caps);
 }
 const def=definitions[tool],d=def.descriptor(version,platform,'arm64');const key=platform==='win32'?'win-arm64-zip':'osx-arm64-tar';
 const artifact=def.resolve({index:[{version:'v'+version,lts:'fixture',files:[key],npm:'11.19.1'}],checksums:'a'.repeat(64)+'  '+d.filename,size:100},version,platform,'arm64');
 return archive.buildPrepared(def,plan,artifact,platform==='win32'?"C:\\Users\\Example\\new folder's":"/example/new folder's",Date.now(),tools,caps);
}
test('modo manual habilitado y asistido reservado, sin ejecutor público',async t=>{
 assert.equal(policy.capabilities().modes.assisted.available,false);assert.equal(policy.capabilities().modes.manual.executes,false);
 t.mock.method(archive,'apply',()=>assert.fail('no debe invocar motor anterior'));t.mock.method(go,'apply',()=>assert.fail('no debe invocar motor anterior'));
 for(const recipe of ['go-official-archive-v1','node-official-archive-v1','terraform-official-archive-v1'])await assert.rejects(installers.apply({recipe},'approved'),/deshabilitada/);
 assert.throws(()=>generate(dplan(),{mode:'assisted'},tools,caps),/asistido/);
});
test('catálogo manual separado conserva 80 entradas, 11 skills y 24 perfiles',()=>{
 assert.equal(catalog.validateRecipes(recipes,tools).ok,true);assert.equal(recipes.recipes.length,8);
 assert.equal(tools.tools.length,80);assert.equal(caps.skills.length,11);assert.equal(caps.profiles.length,24);
 assert.equal(catalog.coverage(recipes,tools).tools.filter(t=>t.status==='command-recipe').length,8);
});
for(const method of ['homebrew','winget','apt','dnf'])for(const tool of Object.keys(versions))test(`comandos simulados ${method}/${tool}, sin invocación del gestor`,()=>{
 const platform=method==='winget'?'win32':['apt','dnf'].includes(method)?'linux':'darwin';
 const pin=tool==='docker'&&['homebrew','winget'].includes(method)?'4.55.0':method==='apt'?'1:'+versions[tool]+'-1':method==='dnf'?versions[tool]+'-1':versions[tool];
 const result=generate(dplan([tool],platform,method),{method,packageVersions:{[tool]:pin},repositoryReady:true},tools,caps);
 assert.equal(result.status,'review-ready',JSON.stringify(result.decisions));assert.equal(result.executionAllowed,false);assert.equal(result.environmentRechecked,false);
 assert.ok(mutation(result).length);assert.equal(validateCommandPlan(result,tools,caps).ok,true);
 assert.ok(result.items[0].sources.every(s=>s.startsWith('https://')));assert.equal(result.items[0].space.bytes,null);
 if(method==='winget'){assert.ok(result.steps.find(s=>s.stage==='install').run.args.includes('--no-upgrade'));assert.equal(result.shell,'powershell');}
 if(method==='apt')assert.ok(result.steps.find(s=>s.stage==='install').run.args.includes('--no-remove'));
});
test('selección auto usa sistema/distribución y respeta gestor del plan D',()=>{
 assert.equal(generate(dplan(),{},tools,caps).method,'homebrew');
 assert.equal(generate(dplan(['go'],'win32','winget'),{},tools,caps).method,'winget');
 assert.equal(generate(dplan(['go'],'linux','dnf'),{},tools,caps).method,'dnf');
 assert.throws(()=>generate(dplan(['go'],'darwin','homebrew',{manager:'homebrew'}),{method:'official'},tools,caps),/difiere/);
});
test('no supone distribución por tener apt, ni acepta método de otro sistema',()=>{
 for(const request of [{platform:'linux',method:'apt',distribution:null},{platform:'linux',method:'apt',distribution:{id:'linuxmint',version:'22',like:['ubuntu']}},{platform:'darwin',method:'winget'}]) {
  const p=dplan(['go'],request.platform,request.method,{distribution:request.distribution});const r=generate(p,{method:request.method,packageVersions:{go:'1.27.3-1'}},tools,caps);assert.equal(r.status,'blocked');assert.equal(mutation(r).length,0);
 }
});
test('gestor ausente, versión de paquete no elegida o repositorio pendiente no ofrecen instalación',()=>{
 const cases=[{p:dplan(['go'],'darwin','homebrew',{managers:[]}),o:{method:'homebrew'}},{p:dplan(['go'],'linux','apt'),o:{method:'apt'}},{p:dplan(['docker'],'linux','apt'),o:{method:'apt',packageVersions:{docker:'1:29.0.2-1'}}}];
 for(const c of cases){const r=generate(c.p,c.o,tools,caps);assert.equal(r.status,'needs-decisions');assert.equal(mutation(r).length,0);}
});
test('herramienta compatible se reutiliza y preexistente no se reemplaza',()=>{
 const ok=generate(dplan(['go'],'darwin','homebrew',{checks:[{tool:'go',status:'detected',version:'1.27.3'}]}),{},tools,caps);assert.equal(ok.status,'no-changes');assert.equal(ok.steps.length,0);
 const review=generate(dplan(['node'],'darwin','homebrew',{checks:[{tool:'node',status:'detected',version:'25.2.1'}]}),{},tools,caps);assert.equal(mutation(review).length,0);assert.equal(review.decisions[0].code,'existing-tool-review');
});
test('dependencias excluidas y versiones incompatibles bloquean todo el conjunto',()=>{
 for(const p of [dplan(['go','node'],'darwin','homebrew',{exclude:['go']}),dplan(['go'],'darwin','homebrew',{versions:{go:'1.25.9'}})]) {
  const result=generate(p,{},tools,caps);assert.equal(result.status,'blocked');assert.equal(mutation(result).length,0);
 }
});
test('versión de paquete diferente del lenguaje no se acepta silenciosamente',()=>{
 const r=generate(dplan(['go'],'linux','apt'),{method:'apt',packageVersions:{go:'2:1.24~2'}},tools,caps);assert.equal(r.status,'blocked');assert.equal(mutation(r).length,0);
});
test('rechaza inyección y versiones para herramientas no seleccionadas',()=>{
 for(const pin of ['1.27.3;touch marker','1.27.3$(touch marker)','--unsafe','1.27.3\ncommand'])assert.throws(()=>generate(dplan(),{packageVersions:{go:pin}},tools,caps));
 assert.throws(()=>generate(dplan(),{packageVersions:{node:'24.22.2'}},tools,caps));
 assert.throws(()=>generate(dplan(),{method:'arbitrary'},tools,caps));
});
test('renderizador conserva espacios, comillas, dollar y backticks como datos',()=>{
 const value="folder's $(touch marker) `touch marker`";
 assert.equal(quote(value,'powershell'),"'folder''s $(touch marker) `touch marker`'");
 const shell=process.platform==='win32'?'powershell':'posix';
 const command=render({executable:process.execPath,args:['-p','process.argv[1]',value],stdinFrom:null},shell);
 const result=process.platform==='win32'?spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8'}):spawnSync('/bin/sh',['-c',command],{encoding:'utf8'});assert.equal(result.status,0);assert.equal(result.stdout.trim(),value);
 assert.throws(()=>quote('bad\ncommand','posix'));
});
test('Docker propone comprobaciones separadas sin run, pull, prune, down ni eliminación',()=>{
 const r=generate(dplan(['docker'],'win32','winget'),{packageVersions:{docker:'4.55.0'}},tools,caps);
 const checks=r.steps.filter(s=>s.stage==='verify').map(s=>s.run.args.join(' '));
 for(const expected of ['--version','version --format {{.Server.Version}}','compose version','buildx version','list --id Docker.DockerDesktop --exact'])assert.ok(checks.includes(expected));
 assert.ok(r.items[0].risks.includes('desktop-version-differs-from-engine-and-cli'));
 assert.ok(!r.steps.some(s=>['run','pull','prune','down','rm','rmi'].includes(s.run.args[0])));
});
test('Docker Linux declara plugins y contenedor de ejecución; no emite arranque del daemon',()=>{
 const r=generate(dplan(['docker'],'linux','apt'),{packageVersions:{docker:'1:29.0.2-1'},repositoryReady:true},tools,caps);
 for(const dep of ['docker-ce-cli','containerd.io','docker-compose-plugin','docker-buildx-plugin'])assert.ok(r.items[0].dependencies.includes(dep));
 assert.ok(r.items[0].risks.includes('package-manager-may-start-installed-services'));
 assert.ok(!r.steps.some(s=>s.run.executable==='systemctl'||s.command.includes('usermod')));
});
for(const tool of ['go','node','terraform'])for(const platform of ['darwin','win32'])test(`official ${tool}/${platform}: snapshot y comandos de integridad sin red ni disco`,t=>{
 const transport=require('../../scripts/installers/transport');for(const method of ['metadata','readJson','readText','headSize','download'])t.mock.method(transport,method,()=>assert.fail('no se permite red al generar comandos'));
 const saved=snapshot(tool,platform);const r=generate(saved.plan,{method:'official'},tools,caps,recipes,saved);
 assert.equal(r.status,'review-ready');assert.equal(r.executionAllowed,false);assert.equal(validateCommandPlan(r,tools,caps).ok,true);
 const integrity=r.steps.find(s=>s.stage==='integrity'),extract=r.steps.find(s=>s.stage==='extract');assert.ok(extract.requiresSuccessfulSteps.includes(integrity.id));
 assert.ok(r.steps.find(s=>s.stage==='download').command.includes('--proto-redir'));assert.ok(!JSON.stringify(r).includes('install apply'));
});
test('snapshot oficial alterado, caducado o ajeno al plan es rechazado',()=>{
 const s=snapshot();const changed=structuredClone(s);changed.artifact.sha256='b'.repeat(64);assert.throws(()=>generate(s.plan,{method:'official'},tools,caps,recipes,changed));
 const old=go.buildPrepared(s.plan,s.artifact,s.destination,Date.now()-2*60*60*1000,tools,caps);assert.throws(()=>generate(s.plan,{method:'official'},tools,caps,recipes,old));
 assert.throws(()=>generate(dplan(['node']),{method:'official'},tools,caps,recipes,s));
});
test('huella reconstruida rechaza comandos alterados aun recalculando SHA-256',()=>{
 const r=generate(dplan(),{},tools,caps);r.steps[0].run.args=['malicious'];r.steps[0].command='malicious';const {commandPlanId,...payload}=r;r.commandPlanId=digest(payload);
 assert.equal(validateCommandPlan(r,tools,caps).ok,false);
});
test('schema rechaza campos de autorización, extras y recetas obsoletas',()=>{
 const r=generate(dplan(),{},tools,caps);
 for(const patch of [{executionAllowed:true},{mode:'assisted'},{approval:'approved'},{extra:'unexpected'},{recipeDigest:'0'.repeat(64)}])assert.equal(validateCommandPlan({...r,...patch},tools,caps).ok,false);
 const other=structuredClone(recipes);other.recipes[0].version=2;assert.equal(catalog.validateRecipes(other,tools).ok,false);
});
test('generación no muta observación, catálogo ni opciones',()=>{
 const p=dplan(),o={method:'homebrew'},before=JSON.stringify({p,o,recipes,tools,caps});generate(p,o,tools,caps);assert.equal(JSON.stringify({p,o,recipes,tools,caps}),before);
});
test('CLI genera y valida comandos; apply se bloquea antes de leer el archivo',t=>{
 const dir=temp(t),source=path.join(dir,'plan.local.json'),saved=path.join(dir,'commands.local.json');fs.writeFileSync(source,JSON.stringify(dplan()));
 const generated=run('install','commands','--plan',source,'--json');assert.equal(generated.status,0,generated.stderr);fs.writeFileSync(saved,generated.stdout);
 const validated=run('install','validate','--file',saved,'--json');assert.equal(validated.status,0,validated.stderr);assert.equal(JSON.parse(validated.stdout).executionAllowed,false);
 const human=run('install','commands','--plan',source);assert.match(human.stdout,/Modo manual/);assert.match(human.stdout,/brew/);
 const blocked=run('install','apply','--file',path.join(dir,'does-not-exist'),'--approve','approved');assert.equal(blocked.status,1);assert.match(blocked.stderr,/deshabilitado/);assert.ok(!blocked.stderr.includes('leer'));
 assert.equal(run('install','commands','--plan',source,'--mode','assisted').status,1);
 assert.equal(run('install','commands','--plan',source,'--file',saved).status,1);
});
test('CLI no llama gestores al renderizar, aunque estén en PATH',t=>{
 if(process.platform==='win32')return t.skip('fixture POSIX');const dir=temp(t),file=path.join(dir,'p.local.json'),marker=path.join(dir,'executed');fs.writeFileSync(file,JSON.stringify(dplan()));
 const fake=path.join(dir,'brew');fs.writeFileSync(fake,`#!/bin/sh\nprintf unexpected > '${marker}'\n`,{mode:0o755});
 const r=spawnSync(process.execPath,[cli,'install','commands','--plan',file,'--json'],{encoding:'utf8',env:{...process.env,PATH:dir}});assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(marker),false);
});
test('snapshot no se puede insertar en métodos nativos ni aceptar campos privados extra',()=>{
 const s=snapshot();assert.throws(()=>generate(s.plan,{method:'homebrew'},tools,caps,recipes,s),/snapshot/);
 const r=generate(dplan(),{},tools,caps);const changed={...r,artifactSnapshot:{secret:'synthetic-private-value'}};const {commandPlanId,...payload}=changed;changed.commandPlanId=digest(payload);assert.equal(validateCommandPlan(changed,tools,caps).ok,false);
});
test('rutas Windows de extracción son absolutas y hashes preceden la extracción',()=>{
 const s=snapshot('go','win32'),r=generate(s.plan,{method:'official'},tools,caps,recipes,s);
 assert.equal(r.steps.find(step=>step.stage==='extract').run.executable,path.win32.join('C:/Windows','System32','tar.exe'));
 assert.ok(r.steps.find(step=>step.stage==='extract').requiresSuccessfulSteps.includes(r.steps.find(step=>step.stage==='integrity').id));
});

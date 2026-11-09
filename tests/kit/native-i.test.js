'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const gen=require('../../scripts/docker/generate'),backends=require('../../scripts/docker/backends'),legacy=require('../../scripts/docker/backends-v1'),schema=require('../../scripts/docker/schema');
const native=require('../../scripts/workspace/native-check'),environment=require('../../scripts/workspace/environment');
const versions={node:'24.22.2',python:'3.13.18',go:'1.27.3',java:'21.0.8',dotnet:'10.0.100'};
const base={node:{runtime:'node:24.22.2-alpine'},python:{runtime:'python:3.13.18-alpine'},go:{runtime:'alpine:3.22.1',builder:'golang:1.27.3-alpine'},java:{runtime:'eclipse-temurin:21.0.8_9-jre',builder:'eclipse-temurin:21.0.8_9-jdk'},dotnet:{runtime:'mcr.microsoft.com/dotnet/aspnet:10.0.0-alpine',builder:'mcr.microsoft.com/dotnet/sdk:10.0.100-alpine'}};
for(const stack of Object.keys(versions))test(`compatibilidad anterior ${stack}: template 1.0 intacta y schema oficial válido`,()=>{
 assert.deepEqual(backends.files(stack,versions[stack],base[stack]),legacy.files(stack,versions[stack],base[stack]));
 const p=gen.plan({services:['postgres'],backend:stack,version:versions[stack],images:{postgres:'postgres:17.6',...base[stack]}});
 assert.equal(p.templateVersion,'1.0.0');assert.equal(Object.hasOwn(p.request,'templateVersion'),false);assert.equal(schema.validateCompose(p.compose).ok,true);
});
for(const id of gen.DATABASES)test(`schema Compose oficial para ${id}, sin motor`,()=>{const refs={postgres:'postgres:17.6',mariadb:'mariadb:11.8.3',mysql:'mysql:8.4.6',mongo:'mongo:8.0.13',redis:'redis:8.2.1'};const p=gen.plan({services:[id],images:{[id]:refs[id]}});const r=schema.validateCompose(p.compose);assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.dockerExecuted,false);});
test('schema rechaza campos inválidos y no muestra valores de credenciales',()=>{
 const data={services:{backend:{image:'example:1.0.0',privileged:'synthetic-private-value',invalidField:'synthetic-private-value'}}};
 const r=schema.validateCompose(data);assert.equal(r.ok,false);assert.ok(r.errors.length);assert.ok(!JSON.stringify(r).includes('synthetic-private-value'));
});
for(const stack of ['node','python','java'])test(`template 1.1 ${stack}: bind/puerto configurables, plan y registro reproducibles`,t=>{
 const p=gen.plan({services:[],backend:stack,version:versions[stack],images:base[stack],templateVersion:'1.1.0'});assert.equal(p.templateVersion,'1.1.0');assert.equal(gen.validate(p).ok,true);assert.equal(schema.validateCompose(p.compose).ok,true);
 const text=p.files.filter(f=>f.path.startsWith('backend/')).map(f=>f.content).join('\n');assert.match(text,/HOST/);assert.match(text,/PORT/);
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-native-plan-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const out=path.join(root,'new');gen.write(p,out);const manifest=environment.exportManifest(out);assert.equal(environment.validateManifest(manifest).ok,true);assert.equal(environment.restore(manifest).templateVersion,'1.1.0');
});
test('no permite versión de plantilla arbitraria ni stack nativo desconocido',async()=>{
 assert.throws(()=>gen.plan({services:[],backend:'node',version:versions.node,images:base.node,templateVersion:'99.0.0'}));
 for(const stacks of [['node;command'],['node','node'],[]])await assert.rejects(native.native({stacks}),/stacks/);
});
test('CLI valida esquema y no arranca pruebas nativas sin acción explícita',()=>{
 const cli=path.resolve(__dirname,'../../scripts/kit.js');const report=spawnSync(process.execPath,[cli,'verify','runtime','--json'],{encoding:'utf8',env:{...process.env,PATH:''}});assert.equal(report.status,0,report.stderr);assert.equal(JSON.parse(report.stdout).checks.length,25);assert.equal(JSON.parse(report.stdout).mutationsPerformed,false);
 const invalid=spawnSync(process.execPath,[cli,'verify','native','--stacks','unknown'],{encoding:'utf8'});assert.equal(invalid.status,1);assert.match(invalid.stderr,/stacks/);
});
test('sin Compose instalado informa pendiente y no lo instala',()=>{
 const verify=require('../../scripts/workspace/compose-check');const r=verify.compose({requireDocker:true},{env:{PATH:''},spawn:()=>assert.fail('no debe ejecutar')});assert.equal(r.status,'unavailable');assert.equal(r.ok,false);assert.equal(r.imagesPulled,false);assert.equal(r.containersStarted,false);
});
test('parser Compose simulado solo recibe version y config quiet en diez proyectos temporales',()=>{
 const verify=require('../../scripts/workspace/compose-check'),seen=[];
 const r=verify.compose({requireDocker:true},{platform:'darwin',env:{PATH:'/trusted'},stat:()=>({isFile:()=>true}),access:()=>{},spawn:(exe,args,options)=>{seen.push(args);assert.equal(options.shell,false);assert.ok(args[0]==='compose');if(args[1]==='version')return {status:0,stdout:'2.40.0'};assert.deepEqual(args.slice(-2),['config','--quiet']);assert.ok(fs.existsSync(args[args.indexOf('--file')+1]));return {status:0,stdout:''};}});
 assert.equal(r.ok,true);assert.equal(r.checks.length,10);assert.equal(r.engineContacted,false);assert.ok(!seen.flat().includes('up'));assert.ok(!seen.flat().includes('pull'));assert.equal(r.temporaryFilesRemoved,true);
});
test('errores del parser no exponen stderr ni valores secretos',()=>{
 const verify=require('../../scripts/workspace/compose-check');const r=verify.compose({}, {platform:'darwin',env:{PATH:'/trusted'},stat:()=>({isFile:()=>true}),access:()=>{},spawn:(exe,args)=>args[1]==='version'?{status:0,stdout:'2.40.0'}:{status:1,stderr:'synthetic-private-value'}});assert.equal(r.ok,false);assert.ok(!JSON.stringify(r).includes('synthetic-private-value'));
});

'use strict';
// Explicit native validation only: own temporary files and localhost processes.
// No package installation, SDK download, Docker startup, remote command or project code execution.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {createContext,findExecutables}=require('../doctor/environment');
const gen=require('../docker/generate');
const TARGET={node:'24.22.2',python:'3.13.18',java:'21.0.8'};
function environment(cwd,port=0){const value={PATH:process.env.PATH||'',HOME:cwd,TMPDIR:cwd,TEMP:cwd,TMP:cwd,HOST:'127.0.0.1',PORT:String(port),LANG:'C',LC_ALL:'C',PYTHONDONTWRITEBYTECODE:'1',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};if(process.platform==='win32'){value.SystemRoot=process.env.SystemRoot||path.win32.resolve('C:/Windows');value.WINDIR=value.SystemRoot;}return value;}
function executable(name){const c=createContext();return findExecutables(name,c).find(f=>process.platform!=='win32'||f.toLowerCase().endsWith('.exe')&&!/[\\/]WindowsApps[\\/]/i.test(f))||null;}
function javaPair(cwd){
 const homes=[process.env.JAVA_HOME_21_X64,process.env.JAVA_HOME_21_ARM64,process.env.JAVA_HOME].filter(p=>p&&path.isAbsolute(p));
 const ext=process.platform==='win32'?'.exe':'';
 const pairs=homes.map(home=>({exe:path.join(home,'bin','java'+ext),compiler:path.join(home,'bin','javac'+ext)}));pairs.push({exe:executable('java'),compiler:executable('javac')});
 for(const pair of pairs){if(!pair.exe||!pair.compiler)continue;const cv=version(pair.compiler,['-version'],cwd),rv=version(pair.exe,['--version'],cwd);if(cv&&rv&&Number(cv.split('.')[0])>=21&&Number(rv.split('.')[0])>=21)return {...pair,runtime:rv,compilerVersion:cv};}
 return {exe:null,compiler:null,runtime:null,compilerVersion:null};
}
function run(file,args,cwd,port=0,timeout=15000){return spawnSync(file,args,{cwd,env:environment(cwd,port),encoding:'utf8',timeout,maxBuffer:32768,shell:false,windowsHide:true});}
function version(file,args,cwd){if(!file)return null;const r=run(file,args,cwd,0,5000);if(r.error||r.status!==0)return null;const m=(r.stdout+'\n'+r.stderr).match(/\b(?:v)?(\d+(?:\.\d+){1,2})\b/);return m?m[1]:null;}
function health(port,route){return new Promise((resolve,reject)=>{const request=http.get({hostname:'127.0.0.1',port,path:route,timeout:2500},response=>{let body='';response.on('data',data=>{body+=data;if(body.length>4096)response.destroy(new Error('Respuesta de prueba demasiado grande.'));});response.on('end',()=>resolve({status:response.statusCode,body}));response.on('error',reject);});request.on('timeout',()=>request.destroy(new Error('Tiempo HTTP agotado.')));request.on('error',reject);});}
async function stop(child){if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return true;return await new Promise(resolve=>{let done=false;const end=()=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(hard);resolve(child.exitCode!==null||child.signalCode!==null);};child.once('close',end);const timer=setTimeout(()=>child.kill('SIGKILL'),6500),hard=setTimeout(end,8500);child.kill('SIGTERM');});}
async function launch(file,args,cwd){
 const child=spawn(file,args,{cwd,env:environment(cwd),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let failure='server-startup-failed';
 try{const port=await new Promise((resolve,reject)=>{let text='',errors='';const timer=setTimeout(()=>finish(new Error('timeout')),10000);let settled=false;
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);}
  child.once('error',e=>{if(['EPERM','EACCES'].includes(e.code))failure='local-process-permission-denied';finish(e);});
  child.stderr.on('data',data=>{errors=(errors+String(data)).slice(-4096);if(/EPERM|EACCES|Operation not permitted|Permission denied/.test(errors))failure='loopback-or-process-permission-denied';});
  child.stdout.on('data',data=>{text=(text+String(data)).slice(-8192);for(const line of text.split(/\r?\n/)){let value;try{value=JSON.parse(line).port;}catch{value=/^READY_PORT=(\d+)$/.exec(line)?.[1];}const n=Number(value);if(Number.isInteger(n)&&n>=1024&&n<=65535)return finish(null,n);}});
  child.once('exit',()=>finish(new Error('early-exit')));
 });return {child,port};}catch{await stop(child);const e=new Error(failure);e.reason=failure;throw e;}
}
function materialize(stack,dir,templateVersion){
 const images={runtime:stack==='node'?'node:24.22.2-alpine':stack==='python'?'python:3.13.18-alpine':'eclipse-temurin:21.0.8_9-jre',...(stack==='java'?{builder:'eclipse-temurin:21.0.8_9-jdk'}:{})};
 const plan=gen.plan({name:'native-validation',services:[],backend:stack,version:TARGET[stack],images,templateVersion});
 const source=plan.files.filter(f=>f.path.startsWith('backend/'));for(const f of source){const file=path.join(dir,f.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,f.content,{flag:'wx',mode:0o600});}
 return {plan,sourceDigest:crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex'),root:path.join(dir,'backend')};
}
async function native(options={}){
 const stacks=options.stacks||['node','python','java'];if(!Array.isArray(stacks)||!stacks.length||new Set(stacks).size!==stacks.length||stacks.some(s=>!Object.hasOwn(TARGET,s)))throw new Error('Selecciona stacks nativos soportados: node, python, java.');
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-native-check-')),checks=[];
 try{for(const stack of stacks){
  const dir=path.join(root,stack);fs.mkdirSync(dir,{mode:0o700});const generated=materialize(stack,dir,'1.1.0');
  const java=stack==='java'?javaPair(dir):null;
  const exe=stack==='node'?process.execPath:stack==='python'?(executable('python3')||executable('python')):java.exe,compiler=java?.compiler;
  const runtime=java?java.runtime:version(exe,['--version'],dir),compilerVersion=java?.compilerVersion||null;
  const base={stack,templateVersion:'1.1.0',requestedRuntime:TARGET[stack],runtimeVersion:runtime,exactRuntimeMatch:runtime===TARGET[stack],sourceDigest:generated.sourceDigest};
  if(!runtime||stack==='java'&&(!compilerVersion||Number(compilerVersion.split('.')[0])<21)) {checks.push({...base,status:'skipped',reason:'required-existing-runtime-or-compiler-unavailable'});continue;}
  let server;
  try{
   let serverArgs,healthArgs;
   if(stack==='java'){
    const compiled=path.join(dir,'classes');fs.mkdirSync(compiled);const result=run(compiler,['--release','21','--add-modules','jdk.httpserver','-d',compiled,path.join(generated.root,'Main.java')],dir,0,30000);
    if(result.error||result.status!==0)throw new Error('java-compilation-failed');base.compilerVersion=compilerVersion;base.targetRelease=21;base.compilationPassed=true;
    const legacyDir=path.join(dir,'legacy');fs.mkdirSync(legacyDir);const legacy=materialize(stack,legacyDir,'1.0.0');const old=run(compiler,['--release','21','--add-modules','jdk.httpserver','-d',legacyDir,path.join(legacy.root,'Main.java')],dir,0,30000);if(old.error||old.status!==0)throw new Error('legacy-java-compilation-failed');base.legacyTemplateCompilationPassed=true;
    serverArgs=['--add-modules','jdk.httpserver','-cp',compiled,'Main'];healthArgs=[...serverArgs,'--healthcheck'];
   }else if(stack==='python'){
    const parsed=run(exe,['-c',"import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text())",path.join(generated.root,'server.py')],dir);if(parsed.error||parsed.status!==0)throw new Error('python-syntax-failed');base.syntaxPassed=true;serverArgs=[path.join(generated.root,'server.py')];healthArgs=[...serverArgs,'--healthcheck'];
   }else{const parsed=run(exe,['--check',path.join(generated.root,'server.js')],dir);if(parsed.error||parsed.status!==0)throw new Error('node-syntax-failed');base.syntaxPassed=true;serverArgs=[path.join(generated.root,'server.js')];healthArgs=[path.join(generated.root,'healthcheck.js')];}
   server=await launch(exe,serverArgs,dir);const ready=await health(server.port,'/health'),missing=await health(server.port,'/not-found');
   if(ready.status!==200||JSON.parse(ready.body).status!=='ok'||missing.status!==404)throw new Error('http-contract-failed');
   const healthcheck=run(exe,healthArgs,dir,server.port,10000);if(healthcheck.error||healthcheck.status!==0)throw new Error('native-healthcheck-failed');
   checks.push({...base,status:'passed',httpHealth:200,httpUnknownRoute:404,healthcheckExitCode:0,binding:'loopback-ephemeral',serverStopped:true});
  }catch(e){checks.push({...base,status:'failed',reason:e.reason||(['java-compilation-failed','legacy-java-compilation-failed','python-syntax-failed','node-syntax-failed','http-contract-failed','native-healthcheck-failed'].includes(e.message)?e.message:'native-validation-failed')});}
  finally{const stopped=await stop(server?.child);if(server&&checks.length){const last=checks[checks.length-1];last.serverStopped=stopped;if(!stopped){last.status='failed';last.reason='server-cleanup-failed';}}}
 }}finally{fs.rmSync(root,{recursive:true,force:true});}
 return {schemaVersion:1,kind:'native-backend-verification',host:{platform:process.platform,architecture:process.arch,nodeVersion:process.versions.node},ok:checks.every(c=>c.status!=='failed')&&(!options.requireAll||checks.every(c=>c.status==='passed')),checks,temporaryFilesRemoved:true,globalChanges:false,installationsPerformed:false,containersStarted:false,
  limitations:['Procesos HTTP temporales solo en 127.0.0.1 y puertos asignados por el sistema.','No certifica imágenes Docker ni coincidencia exacta con los SDK solicitados; revisa exactRuntimeMatch.','No valida Windows/Linux/macOS Intel si el host actual es distinto.','Go/.NET y pruebas de motores de datos necesitan herramientas/entornos adicionales; no se instalan.']};
}
module.exports={native};
